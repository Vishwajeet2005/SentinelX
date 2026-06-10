package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"log"
	"net"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/Shopify/sarama"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

const (
	MaxVarianceMS = 2000
	WorkerCount   = 100
)

var secretKey []byte

func init() {
	key := os.Getenv("HMAC_SECRET")
	if key == "" {
		log.Println("WARNING: HMAC_SECRET not set, using insecure default key!")
		key = "REPLACE_WITH_SECURE_32_BYTE_KEY"
	}
	secretKey = []byte(key)
	
	prometheus.MustRegister(packetsReceived)
	prometheus.MustRegister(framesProcessed)
	prometheus.MustRegister(droppedPayloads)
}

// Prometheus Metrics
var (
	packetsReceived = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "sentinx_edge_packets_received_total",
		Help: "Total UDP packets received",
	})
	framesProcessed = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "sentinx_edge_frames_processed_total",
		Help: "Total telemetry frames processed and sent to Kafka",
	})
	droppedPayloads = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "sentinx_edge_dropped_payloads_total",
		Help: "Total payloads dropped due to errors or sequence issues",
	})
)

// PayloadHeader perfectly packed at 64 bytes
type PayloadHeader struct {
	HMAC        [32]byte
	ClientID    uint64
	SequenceID  uint64
	TimestampMS uint64
	Nonce       uint32
	FrameCount  uint32
}

type TelemetryFrame struct {
	PosX         float32
	PosY         float32
	PosZ         float32
	Pitch        float32
	Yaw          float32
	FrameDeltaMS float32
	TimestampMS  uint64
	InputFlags   uint32
	Reserved     uint32
}

// JSONFrame maps to Kafka & ClickHouse
type JSONFrame struct {
	PosX           float32 `json:"PosX"`
	PosY           float32 `json:"PosY"`
	PosZ           float32 `json:"PosZ"`
	Pitch          float32 `json:"Pitch"`
	Yaw            float32 `json:"Yaw"`
	FrameDeltaMS   float32 `json:"FrameDeltaMS"`
	TimestampMS    uint64  `json:"TimestampMS"`
	InputFlags     uint32  `json:"InputFlags"`
	IsInterpolated uint8   `json:"IsInterpolated"`
}

type JSONPayload struct {
	ClientID    uint64      `json:"client_id"`
	SequenceID  uint64      `json:"sequence_id"`
	TimestampMS uint64      `json:"timestamp_ms"`
	Frames      []JSONFrame `json:"frames"`
}

type ClientState struct {
	mu        sync.Mutex
	lastSeqID uint64
	lastFrame *JSONFrame
	lastSeen  time.Time
}

var clientStates = make(map[uint64]*ClientState)
var stateMu sync.Mutex

func getClientState(clientID uint64) *ClientState {
	stateMu.Lock()
	defer stateMu.Unlock()
	if state, exists := clientStates[clientID]; exists {
		state.lastSeen = time.Now()
		return state
	}
	state := &ClientState{lastSeen: time.Now()}
	clientStates[clientID] = state
	return state
}

type ReplayCache struct {
	sync.RWMutex
	cache map[uint64]time.Time
}
var replayCache = ReplayCache{cache: make(map[uint64]time.Time)}

func main() {
	log.Println("Starting SentinX Edge Ingestion Node (with Jitter Buffer & Interpolation)...")

	// Start Prometheus Metrics Server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Println("Prometheus metrics server running on :2112")
		log.Fatal(http.ListenAndServe(":2112", nil))
	}()

	// Garbage Collection for Replay Cache
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			replayCache.Lock()
			now := time.Now()
			for k, v := range replayCache.cache {
				if now.Sub(v) > 5*time.Minute { delete(replayCache.cache, k) }
			}
			replayCache.Unlock()
		}
	}()

	// Garbage Collection for Client States
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			stateMu.Lock()
			now := time.Now()
			for k, v := range clientStates {
				v.mu.Lock()
				if now.Sub(v.lastSeen) > 10*time.Minute {
					v.mu.Unlock()
					delete(clientStates, k)
				} else {
					v.mu.Unlock()
				}
			}
			stateMu.Unlock()
		}
	}()

	broker := os.Getenv("KAFKA_BROKER")
	if broker == "" {
		broker = "localhost:9092"
	}

	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	producer, err := sarama.NewSyncProducer([]string{broker}, config)
	if err != nil {
		log.Printf("Kafka not found, proceeding in dev mode: %v", err)
	} else {
		defer producer.Close()
	}

	addr, err := net.ResolveUDPAddr("udp", ":8080")
	if err != nil { log.Fatalf("Address error: %v", err) }
	conn, err := net.ListenUDP("udp", addr)
	if err != nil { log.Fatalf("Listen error: %v", err) }
	defer conn.Close()

	payloadChan := make(chan []byte, 10000)
	for i := 0; i < WorkerCount; i++ {
		go worker(payloadChan, producer)
	}

	log.Println("Listening for raw telemetry on UDP :8080")

	buf := make([]byte, 65536)
	for {
		n, _, err := conn.ReadFromUDP(buf)
		if err != nil { continue }
		
		packetsReceived.Inc()
		payload := make([]byte, n)
		copy(payload, buf[:n])
		
		select {
		case payloadChan <- payload:
		default:
			log.Println("Worker pool saturated, dropping payload to fail-open routing")
		}
	}
}

func worker(payloadChan <-chan []byte, producer sarama.SyncProducer) {
	for payload := range payloadChan {
		if err := processPayload(payload, producer); err != nil {
			droppedPayloads.Inc()
			log.Printf("Payload validation error: %v", err)
		}
	}
}

func processPayload(payload []byte, producer sarama.SyncProducer) error {
	if len(payload) < 64 {
		return errors.New("payload too small")
	}

	var header PayloadHeader
	buf := bytes.NewReader(payload)
	if err := binary.Read(buf, binary.LittleEndian, &header); err != nil {
		return err
	}

	mac := hmac.New(sha256.New, secretKey)
	mac.Write(payload[32:]) 
	expectedMAC := mac.Sum(nil)
	if !hmac.Equal(header.HMAC[:], expectedMAC) {
		return errors.New("HMAC signature mismatch (tampered payload)")
	}

	// Replay Protection: Drop packets with already processed HMAC signatures
	sigHash := binary.LittleEndian.Uint64(header.HMAC[:8])
	replayCache.RLock()
	_, exists := replayCache.cache[sigHash]
	replayCache.RUnlock()
	if exists {
		return errors.New("replay attack detected: signature already processed")
	}

	replayCache.Lock()
	replayCache.cache[sigHash] = time.Now()
	replayCache.Unlock()

	now := uint64(time.Now().UnixNano() / int64(time.Millisecond))
	var variance uint64
	if now > header.TimestampMS {
		variance = now - header.TimestampMS
	} else {
		variance = header.TimestampMS - now
	}

	if variance > MaxVarianceMS {
		return errors.New("payload timestamp variance exceeded")
	}

	if header.FrameCount > 1024 {
		return errors.New("frame count exceeds maximum allowed (potential DoS)")
	}

	frames := make([]TelemetryFrame, header.FrameCount)
	if err := binary.Read(buf, binary.LittleEndian, &frames); err != nil {
		return err
	}

	// Fetch Jitter Buffer per Client
	cState := getClientState(header.ClientID)
	cState.mu.Lock()
	defer cState.mu.Unlock()

	// Out-of-order drop handling
	if header.SequenceID <= cState.lastSeqID && cState.lastSeqID != 0 {
		return errors.New("duplicate or late out-of-order packet dropped")
	}
    
	// Internal Packet Jitter sort
	sort.Slice(frames, func(i, j int) bool {
		return frames[i].TimestampMS < frames[j].TimestampMS
	})

	var processedFrames []JSONFrame

	// Forward Linear Prediction Interpolation for dropped UDP packets
	if cState.lastSeqID != 0 && header.SequenceID > cState.lastSeqID + 1 {
		if cState.lastFrame != nil && len(frames) > 0 {
			start := cState.lastFrame
			end := frames[0]
            
			// Half-step interpolation to repair ML tensor continuity
			ratio := float32(0.5)
			
			// Prevent Timestamp Underflow
			var newTime uint64
			if end.TimestampMS >= start.TimestampMS {
				newTime = start.TimestampMS + uint64(float32(end.TimestampMS-start.TimestampMS)*ratio)
			} else {
				// Fallback to start time if timestamps are anomalous
				newTime = start.TimestampMS
			}

			synthetic := JSONFrame{
				PosX:           start.PosX + (end.PosX - start.PosX)*ratio,
				PosY:           start.PosY + (end.PosY - start.PosY)*ratio,
				PosZ:           start.PosZ + (end.PosZ - start.PosZ)*ratio,
				Pitch:          start.Pitch + (end.Pitch - start.Pitch)*ratio,
				Yaw:            start.Yaw + (end.Yaw - start.Yaw)*ratio,
				FrameDeltaMS:   16.666, // SERVER AUTHORITATIVE TIME OVERRIDE
				TimestampMS:    newTime,
				InputFlags:     start.InputFlags,
				IsInterpolated: 1,
			}
			processedFrames = append(processedFrames, synthetic)
		}
	}

	for _, f := range frames {
		processedFrames = append(processedFrames, JSONFrame{
			PosX: f.PosX, PosY: f.PosY, PosZ: f.PosZ,
			Pitch: f.Pitch, Yaw: f.Yaw, 
			FrameDeltaMS: 16.666, // SERVER AUTHORITATIVE TIME OVERRIDE
			TimestampMS: f.TimestampMS, InputFlags: f.InputFlags,
			IsInterpolated: 0,
		})
	}
	
	framesProcessed.Add(float64(len(processedFrames)))

	cState.lastSeqID = header.SequenceID
	if len(processedFrames) > 0 {
		cState.lastFrame = &processedFrames[len(processedFrames)-1]
	}

	// Prepare JSON for Kafka pipeline (ClickHouse/Python)
	outPayload := JSONPayload{
		ClientID:    header.ClientID,
		SequenceID:  header.SequenceID,
		TimestampMS: header.TimestampMS,
		Frames:      processedFrames,
	}
    
	outBytes, err := json.Marshal(outPayload)
	if err != nil { return err }

	if producer != nil {
		msg := &sarama.ProducerMessage{
			Topic: "sentinx_telemetry",
			Value: sarama.ByteEncoder(outBytes),
		}
		_, _, err := producer.SendMessage(msg)
		return err
	} else {
		log.Printf("Dev: Client %d, Seq %d, Exported %d frames.", header.ClientID, header.SequenceID, len(processedFrames))
	}
	return nil
}
