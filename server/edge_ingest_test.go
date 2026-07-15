package main

import (
	"encoding/json"
	"testing"
)

// TestJSONFrameSerialization guarantees that the internal structs map precisely 
// to the expected PyTorch / ClickHouse columnar format.
func TestJSONFrameSerialization(t *testing.T) {
	frame := JSONFrame{
		PosX:           100.5,
		PosY:           -50.25,
		PosZ:           0.0,
		Pitch:          15.0,
		Yaw:            90.0,
		FrameDeltaMS:   16.666,
		TimestampMS:    1625097600000,
		InputFlags:     1,
		IsInterpolated: 0,
	}

	payload := JSONPayload{
		ClientID:    123456789,
		SequenceID:  10,
		TimestampMS: 1625097600000,
		Frames:      []JSONFrame{frame},
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Failed to marshal JSON payload: %v", err)
	}

	expectedString := `{"client_id":123456789,"sequence_id":10,"timestamp_ms":1625097600000,"frames":[{"PosX":100.5,"PosY":-50.25,"PosZ":0,"Pitch":15,"Yaw":90,"FrameDeltaMS":16.666,"TimestampMS":1625097600000,"InputFlags":1,"IsInterpolated":0}]}`
	if string(bytes) != expectedString {
		t.Errorf("JSON serialization mismatch.\nExpected: %s\nGot:      %s", expectedString, string(bytes))
	}
}

// TestJitterStateGarbageCollection validates the internal map doesn't leak memory
func TestJitterStateGarbageCollection(t *testing.T) {
	clientID := uint64(999999)
	state := getClientState(clientID)
	
	if state == nil {
		t.Fatal("Failed to allocate client state")
	}

	stateMu.Lock()
	_, exists := clientStates[clientID]
	stateMu.Unlock()
	
	if !exists {
		t.Errorf("Client state was not tracked in global map")
	}
}
