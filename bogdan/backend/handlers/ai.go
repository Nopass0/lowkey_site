package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"bogdan/backend/config"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	cfg *config.Config
}

func NewAIHandler(cfg *config.Config) *AIHandler {
	return &AIHandler{cfg: cfg}
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Stream      bool          `json:"stream"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

// POST /api/ai/chat
// Body: { "messages": [...], "model": "...", "stream": true, "temperature": 0.7 }
// Returns SSE stream if stream=true, otherwise returns JSON
func (h *AIHandler) Chat(c *gin.Context) {
	var req struct {
		Messages    []ChatMessage `json:"messages" binding:"required"`
		Model       string        `json:"model"`
		Stream      bool          `json:"stream"`
		Temperature float64       `json:"temperature"`
		MaxTokens   int           `json:"max_tokens"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Model == "" {
		req.Model = "bitnet"
	}

	chatReq := ChatRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}

	if req.Stream {
		h.chatStream(c, chatReq)
	} else {
		h.chatSync(c, chatReq)
	}
}

func (h *AIHandler) chatSync(c *gin.Context, req ChatRequest) {
	req.Stream = false
	data, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		h.cfg.BitNet.URL+"/v1/chat/completions",
		bytes.NewReader(data))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "BitNet unreachable: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if resp.StatusCode >= 400 {
		c.JSON(resp.StatusCode, gin.H{"error": string(body)})
		return
	}

	c.Data(resp.StatusCode, "application/json", body)
}

func (h *AIHandler) chatStream(c *gin.Context, req ChatRequest) {
	req.Stream = true
	data, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 300*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		h.cfg.BitNet.URL+"/v1/chat/completions",
		bytes.NewReader(data))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "BitNet unreachable: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		c.JSON(resp.StatusCode, gin.H{"error": string(body)})
		return
	}

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming not supported"})
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		fmt.Fprintf(c.Writer, "%s\n\n", line)
		flusher.Flush()

		// Check if stream is done
		if strings.Contains(line, "[DONE]") {
			break
		}
	}
}

// GET /api/ai/models
func (h *AIHandler) ListModels(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "GET",
		h.cfg.BitNet.URL+"/v1/models", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		// Return default model list if BitNet is unreachable
		c.JSON(http.StatusOK, gin.H{
			"object": "list",
			"data": []gin.H{
				{"id": "bitnet", "object": "model", "owned_by": "bitnet"},
			},
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(resp.StatusCode, "application/json", body)
}

// POST /api/ai/mindmap-suggest
// Body: { "text": "...", "existing_nodes": ["..."] }
// Returns suggested mind map nodes
func (h *AIHandler) MindmapSuggest(c *gin.Context) {
	var req struct {
		Text          string   `json:"text" binding:"required"`
		ExistingNodes []string `json:"existing_nodes"`
		MaxNodes      int      `json:"max_nodes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MaxNodes <= 0 {
		req.MaxNodes = 8
	}

	existingStr := ""
	if len(req.ExistingNodes) > 0 {
		existingStr = fmt.Sprintf("\nExisting nodes: %s\n", strings.Join(req.ExistingNodes, ", "))
	}

	prompt := fmt.Sprintf(`You are a mind map assistant. Given the following text, suggest %d concise mind map nodes/topics that would fit well.
%s
Text: %s

Respond ONLY with a JSON array of strings, e.g. ["Node 1", "Node 2", "Node 3"]. No explanation.`,
		req.MaxNodes, existingStr, req.Text)

	chatReq := ChatRequest{
		Model: "bitnet",
		Messages: []ChatMessage{
			{Role: "user", Content: prompt},
		},
		Stream:    false,
		MaxTokens: 256,
	}

	data, err := json.Marshal(chatReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		h.cfg.BitNet.URL+"/v1/chat/completions",
		bytes.NewReader(data))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "BitNet unreachable: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if resp.StatusCode >= 400 {
		c.JSON(resp.StatusCode, gin.H{"error": string(body)})
		return
	}

	// Parse the OpenAI-compatible response
	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse AI response"})
		return
	}

	if len(openAIResp.Choices) == 0 {
		c.JSON(http.StatusOK, gin.H{"nodes": []string{}})
		return
	}

	content := strings.TrimSpace(openAIResp.Choices[0].Message.Content)

	// Find the JSON array in the response
	start := strings.Index(content, "[")
	end := strings.LastIndex(content, "]")
	if start == -1 || end == -1 || end <= start {
		// Fallback: split by newlines
		lines := strings.Split(content, "\n")
		nodes := make([]string, 0, len(lines))
		for _, l := range lines {
			l = strings.TrimSpace(l)
			l = strings.TrimPrefix(l, "- ")
			l = strings.TrimPrefix(l, "* ")
			if l != "" {
				nodes = append(nodes, l)
			}
		}
		c.JSON(http.StatusOK, gin.H{"nodes": nodes})
		return
	}

	jsonArr := content[start : end+1]
	var nodes []string
	if err := json.Unmarshal([]byte(jsonArr), &nodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse node list"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"nodes": nodes})
}
