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

// Monitor center HTTP handlers (custom feature, not part of upstream new-api).
// Admin only: usage overview, channel health probes and model IQ tests.

package controller

import (
	"context"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// GetMonitorOverview returns today's usage aggregates plus health summaries.
func GetMonitorOverview(c *gin.Context) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()

	var todayRequests int64
	var todayQuota int64
	var todayTokens int64
	var todayErrors int64
	logDB := model.LOG_DB
	if logDB != nil {
		_ = logDB.Model(&model.Log{}).
			Where("type = ? AND created_at >= ?", model.LogTypeConsume, startOfDay).
			Count(&todayRequests).Error
		row := logDB.Model(&model.Log{}).
			Where("type = ? AND created_at >= ?", model.LogTypeConsume, startOfDay).
			Select("COALESCE(SUM(quota),0) AS q, COALESCE(SUM(prompt_tokens + completion_tokens),0) AS t").
			Row()
		_ = row.Scan(&todayQuota, &todayTokens)
		_ = logDB.Model(&model.Log{}).
			Where("type = ? AND created_at >= ?", model.LogTypeError, startOfDay).
			Count(&todayErrors).Error
	}
	errorRate := float64(0)
	if todayRequests+todayErrors > 0 {
		errorRate = float64(todayErrors) * 100 / float64(todayRequests+todayErrors)
	}

	channels, _ := model.GetAllChannels(0, 10000, true, false)
	enabledCount := 0
	for _, ch := range channels {
		if ch.Status == common.ChannelStatusEnabled {
			enabledCount++
		}
	}
	latestProbes, _ := model.GetLatestChannelProbes()
	health := map[string]int{"healthy": 0, "slow": 0, "very_slow": 0, "down": 0}
	for _, probe := range latestProbes {
		switch probe.Status {
		case model.ProbeStatusHealthy:
			health["healthy"]++
		case model.ProbeStatusSlow:
			health["slow"]++
		case model.ProbeStatusVerySlow:
			health["very_slow"]++
		default:
			health["down"]++
		}
	}
	latestIQRuns, _ := model.GetLatestIQTestRuns()

	common.ApiSuccess(c, gin.H{
		"today_requests":   todayRequests,
		"today_quota":      todayQuota,
		"today_tokens":     todayTokens,
		"today_errors":     todayErrors,
		"error_rate":       errorRate,
		"channels_total":   len(channels),
		"channels_enabled": enabledCount,
		"health":           health,
		"latest_probes":    latestProbes,
		"latest_iq_runs":   latestIQRuns,
	})
}

type monitorChannelItem struct {
	Id        int                 `json:"id"`
	Name      string              `json:"name"`
	Type      int                 `json:"type"`
	Status    int                 `json:"status"`
	Group     string              `json:"group"`
	Models    []string            `json:"models"`
	TestModel string              `json:"test_model"`
	Probe     *model.ChannelProbe `json:"probe"`
	IQ        *model.IQTestRun    `json:"iq"`
}

// GetMonitorChannels lists channels merged with their latest probe and IQ run.
func GetMonitorChannels(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 10000, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	latestProbes, _ := model.GetLatestChannelProbes()
	probeByChannel := make(map[int]*model.ChannelProbe)
	for _, probe := range latestProbes {
		probeByChannel[probe.ChannelId] = probe
	}
	latestIQRuns, _ := model.GetLatestIQTestRuns()
	iqByChannel := make(map[int]*model.IQTestRun)
	for _, run := range latestIQRuns {
		if existing, ok := iqByChannel[run.ChannelId]; !ok || run.Id > existing.Id {
			cp := *run
			cp.Details = ""
			iqByChannel[run.ChannelId] = &cp
		}
	}
	items := make([]monitorChannelItem, 0, len(channels))
	for _, ch := range channels {
		testModel := ""
		if ch.TestModel != nil {
			testModel = *ch.TestModel
		}
		items = append(items, monitorChannelItem{
			Id:        ch.Id,
			Name:      ch.Name,
			Type:      ch.Type,
			Status:    ch.Status,
			Group:     ch.Group,
			Models:    ch.GetModels(),
			TestModel: testModel,
			Probe:     probeByChannel[ch.Id],
			IQ:        iqByChannel[ch.Id],
		})
	}
	common.ApiSuccess(c, items)
}

// ProbeChannelHandler probes one channel now.
func ProbeChannelHandler(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid channel id")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var body struct {
		Model string `json:"model"`
	}
	_ = c.ShouldBindJSON(&body)
	probe := ProbeChannel(c.Request.Context(), channel, body.Model)
	common.ApiSuccess(c, probe)
}

// ProbeAllChannelsHandler starts an asynchronous probe of all enabled channels.
func ProbeAllChannelsHandler(c *gin.Context) {
	go ProbeAllEnabledChannels(context.Background())
	common.ApiSuccess(c, gin.H{"started": true})
}

// GetMonitorProbes returns the probe history, newest first.
func GetMonitorProbes(c *gin.Context) {
	channelId, _ := strconv.Atoi(c.Query("channel_id"))
	pageInfo := common.GetPageQuery(c)
	probes, total, err := model.GetChannelProbes(channelId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(probes)
	common.ApiSuccess(c, pageInfo)
}

// RunIQTestHandler runs the IQ probe set against one channel+model.
func RunIQTestHandler(c *gin.Context) {
	var body struct {
		ChannelId int    `json:"channel_id"`
		Model     string `json:"model"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ChannelId <= 0 {
		common.ApiErrorMsg(c, "channel_id is required")
		return
	}
	channel, err := model.GetChannelById(body.ChannelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Minute)
	defer cancel()
	run, err := RunIQTest(ctx, channel, body.Model, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, run)
}

// GetIQTestRuns returns the IQ test history, newest first.
func GetIQTestRuns(c *gin.Context) {
	channelId, _ := strconv.Atoi(c.Query("channel_id"))
	pageInfo := common.GetPageQuery(c)
	runs, total, err := model.GetIQTestRuns(channelId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(runs)
	common.ApiSuccess(c, pageInfo)
}

// GetMonitorSettings returns the monitor center settings.
func GetMonitorSettings(c *gin.Context) {
	common.ApiSuccess(c, operation_setting.GetMonitorCenterSetting())
}

// UpdateMonitorSettings persists the monitor center settings as options.
func UpdateMonitorSettings(c *gin.Context) {
	var body struct {
		ProbeEnabled         *bool `json:"probe_enabled"`
		ProbeIntervalMinutes *int  `json:"probe_interval_minutes"`
		IQDropThreshold      *int  `json:"iq_drop_threshold"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if body.ProbeEnabled != nil {
		if err := model.UpdateOption("monitor_center_setting.probe_enabled", strconv.FormatBool(*body.ProbeEnabled)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if body.ProbeIntervalMinutes != nil {
		if err := model.UpdateOption("monitor_center_setting.probe_interval_minutes", strconv.Itoa(*body.ProbeIntervalMinutes)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if body.IQDropThreshold != nil {
		if err := model.UpdateOption("monitor_center_setting.iq_drop_threshold", strconv.Itoa(*body.IQDropThreshold)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, operation_setting.GetMonitorCenterSetting())
}
