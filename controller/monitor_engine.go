/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Monitor center engine (custom feature, not part of upstream new-api).
//
// Two halves, with methods borrowed from open-source projects (see CUSTOM.md):
//   - channel health probes: reuse the built-in channel test machinery and
//     persist every result, graded with llm-api-bench's four-tier status
//     (healthy / slow / very slow / down), like relay-status-monitor does for
//     New API upstreams.
//   - model IQ tests: a fixed set of probe questions with deterministic
//     server-side scoring (the approach of ccfingerprint, llm-verify and the
//     candy-eval methodology) to spot silently downgraded or swapped models.

package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ---------------------------------------------------------------------------
// Channel health probes
// ---------------------------------------------------------------------------

const (
	probeHealthyMaxMs   = 3000
	probeSlowMaxMs      = 8000
	probeAllConcurrency = 3
)

func resolveProbeModel(channel *model.Channel) string {
	if channel.TestModel != nil && strings.TrimSpace(*channel.TestModel) != "" {
		return strings.TrimSpace(*channel.TestModel)
	}
	models := channel.GetModels()
	if len(models) > 0 {
		return strings.TrimSpace(models[0])
	}
	return "gpt-4o-mini"
}

// ProbeChannel runs one health probe against a channel and persists the result.
func ProbeChannel(ctx context.Context, channel *model.Channel, modelName string) *model.ChannelProbe {
	if modelName == "" {
		modelName = resolveProbeModel(channel)
	}
	probe := &model.ChannelProbe{
		ChannelId:   channel.Id,
		ChannelName: channel.Name,
		ModelName:   modelName,
	}
	userID, err := resolveChannelTestUserID(nil)
	if err != nil {
		probe.Status = model.ProbeStatusDown
		probe.Error = err.Error()
		_ = model.InsertChannelProbe(probe)
		return probe
	}
	tik := time.Now()
	result := testChannel(ctx, channel, userID, modelName, "", false)
	probe.LatencyMs = time.Since(tik).Milliseconds()
	switch {
	case result.newAPIError != nil:
		probe.Status = model.ProbeStatusDown
		probe.Error = result.newAPIError.Error()
	case result.localErr != nil:
		probe.Status = model.ProbeStatusDown
		probe.Error = result.localErr.Error()
	case probe.LatencyMs <= probeHealthyMaxMs:
		probe.Status = model.ProbeStatusHealthy
	case probe.LatencyMs <= probeSlowMaxMs:
		probe.Status = model.ProbeStatusSlow
	default:
		probe.Status = model.ProbeStatusVerySlow
	}
	if len(probe.Error) > 2000 {
		probe.Error = probe.Error[:2000]
	}
	_ = model.InsertChannelProbe(probe)
	return probe
}

// ProbeAllEnabledChannels probes every enabled channel once.
func ProbeAllEnabledChannels(ctx context.Context) (probed int, down int) {
	channels, err := model.GetAllChannels(0, 10000, true, false)
	if err != nil {
		common.SysLog(common.LogText("monitor probe: failed to list channels: %v", err))
		return 0, 0
	}
	sem := make(chan struct{}, probeAllConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(ch *model.Channel) {
			defer wg.Done()
			defer func() { <-sem }()
			probe := ProbeChannel(ctx, ch, "")
			mu.Lock()
			probed++
			if probe.Status == model.ProbeStatusDown {
				down++
			}
			mu.Unlock()
		}(channel)
	}
	wg.Wait()
	return probed, down
}

// monitorProbeHandler wires the periodic probe into the system task runner.
type monitorProbeHandler struct{}

func (monitorProbeHandler) Type() string { return model.SystemTaskTypeMonitorProbe }

func (monitorProbeHandler) Enabled() bool {
	return operation_setting.GetMonitorCenterSetting().ProbeEnabled
}

func (monitorProbeHandler) Interval() time.Duration {
	minutes := operation_setting.GetMonitorCenterSetting().ProbeIntervalMinutes
	if minutes < 1 {
		minutes = 30
	}
	return time.Duration(minutes) * time.Minute
}

func (monitorProbeHandler) NewPayload() any { return nil }

func (monitorProbeHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	probed, down := ProbeAllEnabledChannels(ctx)
	summary := map[string]any{"probed": probed, "down": down}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

var _ service.ScheduledSystemTaskHandler = monitorProbeHandler{}

// ---------------------------------------------------------------------------
// Model IQ tests
// ---------------------------------------------------------------------------

type iqQuestion struct {
	Id       string   `json:"id"`
	Category string   `json:"category"`
	Prompt   string   `json:"prompt"`
	Check    string   `json:"check"` // "number" (last number in answer) or "any" (contains any alternative)
	Expected string   `json:"expected"`
	Alts     []string `json:"-"`
}

// The fixed probe set. Every question has a deterministic, server-checkable
// answer; prompts and expected values are original to this project.
var iqQuestions = []iqQuestion{
	{Id: "math-warehouse", Category: "数学", Check: "number", Expected: "249",
		Prompt: "一个仓库有 7 箱零件，每箱 24 个。先取出 39 个，又入库 5 箱。请只输出最后仓库里零件的总数，只输出数字，不要解释。"},
	{Id: "math-sequence", Category: "数学", Check: "number", Expected: "42",
		Prompt: "数列 2, 6, 12, 20, 30 的下一个数是什么？只输出数字，不要解释。"},
	{Id: "math-discount", Category: "数学", Check: "number", Expected: "160",
		Prompt: "某商品原价 200 元，打八折后多少钱？只输出数字，不要解释。"},
	{Id: "math-unit", Category: "数学", Check: "number", Expected: "90",
		Prompt: "1.5 小时等于多少分钟？只输出数字，不要解释。"},
	{Id: "logic-height", Category: "逻辑", Check: "any", Expected: "小刚", Alts: []string{"小刚"},
		Prompt: "小明比小红高，小红比小刚高。三人中谁最矮？只输出名字，不要解释。"},
	{Id: "logic-syllogism", Category: "逻辑", Check: "any", Expected: "是", Alts: []string{"是"},
		Prompt: "所有 A 都是 B，所有 B 都是 C。那么所有 A 都是 C 吗？只回答一个字：是 或 否。"},
	{Id: "knowledge-formula", Category: "知识", Check: "any", Expected: "H2O", Alts: []string{"H2O", "H₂O"},
		Prompt: "水的化学式是什么？只输出化学式，不要解释。"},
	{Id: "knowledge-capital", Category: "知识", Check: "any", Expected: "北京", Alts: []string{"北京"},
		Prompt: "中国的首都是哪里？只输出城市名，不要解释。"},
	{Id: "knowledge-pi", Category: "知识", Check: "any", Expected: "3.1416", Alts: []string{"3.1416", "3.1415"},
		Prompt: "圆周率 π 精确到小数点后 4 位是多少？只输出数字，不要解释。"},
	{Id: "count-letters", Category: "推理", Check: "number", Expected: "3",
		Prompt: "英文单词 strawberry 中字母 r 出现几次？只输出数字，不要解释。"},
	{Id: "reason-weekday", Category: "推理", Check: "any", Expected: "星期六", Alts: []string{"星期六", "周六"},
		Prompt: "如果今天是星期三，那么 10 天后是星期几？只输出星期几，不要解释。"},
	{Id: "instruction-case", Category: "指令遵循", Check: "any", Expected: "HELLO", Alts: []string{"HELLO"},
		Prompt: "请只输出单词 hello 的大写形式，不要输出任何其他内容。"},
}

type iqDetailItem struct {
	Id       string `json:"id"`
	Category string `json:"category"`
	Prompt   string `json:"prompt"`
	Expected string `json:"expected"`
	Answer   string `json:"answer"`
	Passed   bool   `json:"passed"`
	Latency  int64  `json:"latency_ms"`
	Error    string `json:"error,omitempty"`
}

var iqNumberRe = regexp.MustCompile(`-?\d+(?:\.\d+)?`)

func checkIQAnswer(q iqQuestion, answer string) bool {
	trimmed := strings.TrimSpace(answer)
	if trimmed == "" {
		return false
	}
	if q.Check == "number" {
		matches := iqNumberRe.FindAllString(trimmed, -1)
		if len(matches) == 0 {
			return false
		}
		got, err1 := strconv.ParseFloat(matches[len(matches)-1], 64)
		want, err2 := strconv.ParseFloat(q.Expected, 64)
		return err1 == nil && err2 == nil && got == want
	}
	lower := strings.ToLower(trimmed)
	for _, alt := range q.Alts {
		if strings.Contains(lower, strings.ToLower(alt)) {
			return true
		}
	}
	return false
}

var iqHTTPClient = &http.Client{Timeout: 120 * time.Second}

// askChannelModel sends one chat prompt straight to the channel's upstream in
// its native API format and returns the plain text answer.
func askChannelModel(ctx context.Context, channel *model.Channel, modelName string, prompt string) (string, error) {
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return "", errors.New("channel has no API key")
	}
	key := strings.TrimSpace(keys[0])
	base := strings.TrimRight(channel.GetBaseURL(), "/")
	if base == "" {
		return "", errors.New("channel base URL is empty")
	}

	var req *http.Request
	var err error
	switch channel.Type {
	case constant.ChannelTypeAzure, constant.ChannelTypeVertexAi:
		return "", fmt.Errorf("channel type %s is not supported for IQ tests", constant.GetChannelTypeName(channel.Type))
	case constant.ChannelTypeAnthropic:
		body, _ := json.Marshal(map[string]any{
			"model":      modelName,
			"max_tokens": 1000,
			"messages":   []map[string]string{{"role": "user", "content": prompt}},
		})
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/messages", bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("x-api-key", key)
		req.Header.Set("anthropic-version", "2023-06-01")
	case constant.ChannelTypeGemini:
		body, _ := json.Marshal(map[string]any{
			"contents": []map[string]any{
				{"parts": []map[string]string{{"text": prompt}}},
			},
			"generationConfig": map[string]any{"temperature": 0, "maxOutputTokens": 1000},
		})
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1beta/models/"+modelName+":generateContent", bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("x-goog-api-key", key)
	default:
		// OpenAI-compatible chat completions.
		path := "/v1/chat/completions"
		if strings.HasSuffix(base, "/v1") {
			path = "/chat/completions"
		}
		body, _ := json.Marshal(map[string]any{
			"model":       modelName,
			"temperature": 0,
			"max_tokens":  1000,
			"messages":    []map[string]string{{"role": "user", "content": prompt}},
		})
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, base+path, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+key)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := iqHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet := string(raw)
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}
		return "", fmt.Errorf("upstream HTTP %d: %s", resp.StatusCode, snippet)
	}
	return extractIQAnswerText(channel.Type, raw)
}

func extractIQAnswerText(channelType int, raw []byte) (string, error) {
	switch channelType {
	case constant.ChannelTypeAnthropic:
		var parsed struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		var parts []string
		for _, block := range parsed.Content {
			if block.Type == "text" {
				parts = append(parts, block.Text)
			}
		}
		return strings.Join(parts, ""), nil
	case constant.ChannelTypeGemini:
		var parsed struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		if len(parsed.Candidates) == 0 {
			return "", errors.New("gemini response has no candidates")
		}
		var parts []string
		for _, part := range parsed.Candidates[0].Content.Parts {
			parts = append(parts, part.Text)
		}
		return strings.Join(parts, ""), nil
	default:
		var parsed struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		if len(parsed.Choices) == 0 {
			return "", errors.New("response has no choices")
		}
		return parsed.Choices[0].Message.Content, nil
	}
}

// RunIQTest runs the whole probe question set against one channel+model and
// persists the scored run.
func RunIQTest(ctx context.Context, channel *model.Channel, modelName string, userID int) (*model.IQTestRun, error) {
	if modelName == "" {
		modelName = resolveProbeModel(channel)
	}
	details := make([]iqDetailItem, len(iqQuestions))
	sem := make(chan struct{}, 3)
	var wg sync.WaitGroup
	for i, q := range iqQuestions {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, question iqQuestion) {
			defer wg.Done()
			defer func() { <-sem }()
			item := iqDetailItem{
				Id:       question.Id,
				Category: question.Category,
				Prompt:   question.Prompt,
				Expected: question.Expected,
			}
			tik := time.Now()
			answer, err := askChannelModel(ctx, channel, modelName, question.Prompt)
			item.Latency = time.Since(tik).Milliseconds()
			if err != nil {
				item.Error = err.Error()
				if len(item.Error) > 300 {
					item.Error = item.Error[:300]
				}
			} else {
				item.Answer = answer
				if len(item.Answer) > 300 {
					item.Answer = item.Answer[:300]
				}
				item.Passed = checkIQAnswer(question, answer)
			}
			details[idx] = item
		}(i, q)
	}
	wg.Wait()

	run := &model.IQTestRun{
		ChannelId:   channel.Id,
		ChannelName: channel.Name,
		ModelName:   modelName,
		Total:       len(iqQuestions),
		CreatedBy:   userID,
	}
	errorCount := 0
	var latencySum int64
	for _, item := range details {
		if item.Error != "" {
			errorCount++
		}
		if item.Passed {
			run.Passed++
		}
		latencySum += item.Latency
	}
	if run.Total > 0 {
		run.AvgLatencyMs = latencySum / int64(run.Total)
		run.Score = run.Passed * 100 / run.Total
	}
	switch {
	case errorCount == run.Total:
		run.Verdict = model.IQVerdictFailed
	case run.Score >= 80:
		run.Verdict = model.IQVerdictOK
	case run.Score >= 60:
		run.Verdict = model.IQVerdictWarning
	default:
		run.Verdict = model.IQVerdictSuspected
	}
	detailsJSON, _ := json.Marshal(details)
	run.Details = string(detailsJSON)
	if err := model.InsertIQTestRun(run); err != nil {
		return nil, err
	}
	// Score-drop detection against the previous run of the same channel+model.
	if prev, err := model.GetPreviousIQTestRun(channel.Id, modelName, run.Id); err == nil && prev != nil {
		threshold := operation_setting.GetMonitorCenterSetting().IQDropThreshold
		if prev.Score-run.Score >= threshold {
			run.DropAlert = true
			_ = model.DB.Save(run).Error
		}
	}
	return run, nil
}
