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

// Monitor center models (custom feature, not part of upstream new-api):
// persistent channel probe history and model IQ test runs.

package model

import (
	"github.com/QuantumNous/new-api/common"
)

// Channel probe health tiers (borrowed from llm-api-bench's four-tier status).
const (
	ProbeStatusDown     = 0 // unreachable / error
	ProbeStatusHealthy  = 1 // responded within the healthy budget
	ProbeStatusSlow     = 2 // responded, but slow
	ProbeStatusVerySlow = 3 // responded, but very slow
)

// IQ test verdicts.
const (
	IQVerdictOK        = 0 // score >= 80
	IQVerdictWarning   = 1 // 60 <= score < 80
	IQVerdictSuspected = 2 // score < 60, suspected downgrade / model swap
	IQVerdictFailed    = 3 // the run itself failed (transport / unsupported)
)

// ChannelProbe is one health probe result against a channel's test model.
type ChannelProbe struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ChannelId   int    `json:"channel_id" gorm:"index"`
	ChannelName string `json:"channel_name" gorm:"type:varchar(128)"`
	ModelName   string `json:"model_name" gorm:"type:varchar(128)"`
	Status      int    `json:"status" gorm:"index"`
	LatencyMs   int64  `json:"latency_ms"`
	Error       string `json:"error" gorm:"type:text"`
	CreatedAt   int64  `json:"created_at" gorm:"index"`
}

// IQTestRun is one completed model IQ test (a fixed probe question set scored
// deterministically on the server side).
type IQTestRun struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ChannelId    int    `json:"channel_id" gorm:"index"`
	ChannelName  string `json:"channel_name" gorm:"type:varchar(128)"`
	ModelName    string `json:"model_name" gorm:"type:varchar(128)"`
	Score        int    `json:"score"`
	Passed       int    `json:"passed"`
	Total        int    `json:"total"`
	AvgLatencyMs int64  `json:"avg_latency_ms"`
	Verdict      int    `json:"verdict" gorm:"index"`
	DropAlert    bool   `json:"drop_alert"`
	Details      string `json:"details" gorm:"type:text"` // JSON array of per-question results
	CreatedBy    int    `json:"created_by"`
	CreatedAt    int64  `json:"created_at" gorm:"index"`
}

func InsertChannelProbe(probe *ChannelProbe) error {
	probe.CreatedAt = common.GetTimestamp()
	return DB.Create(probe).Error
}

// GetLatestChannelProbes returns the newest probe of every channel.
func GetLatestChannelProbes() ([]*ChannelProbe, error) {
	var probes []*ChannelProbe
	sub := DB.Model(&ChannelProbe{}).Select("MAX(id)").Group("channel_id")
	err := DB.Where("id IN (?)", sub).Find(&probes).Error
	return probes, err
}

func GetChannelProbes(channelId int, startIdx int, num int) ([]*ChannelProbe, int64, error) {
	var probes []*ChannelProbe
	var total int64
	query := DB.Model(&ChannelProbe{})
	if channelId > 0 {
		query = query.Where("channel_id = ?", channelId)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&probes).Error
	return probes, total, err
}

func InsertIQTestRun(run *IQTestRun) error {
	run.CreatedAt = common.GetTimestamp()
	return DB.Create(run).Error
}

func GetIQTestRuns(channelId int, startIdx int, num int) ([]*IQTestRun, int64, error) {
	var runs []*IQTestRun
	var total int64
	query := DB.Model(&IQTestRun{})
	if channelId > 0 {
		query = query.Where("channel_id = ?", channelId)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&runs).Error
	return runs, total, err
}

// GetLatestIQTestRuns returns the newest IQ run of every (channel, model) pair.
func GetLatestIQTestRuns() ([]*IQTestRun, error) {
	var runs []*IQTestRun
	sub := DB.Model(&IQTestRun{}).Select("MAX(id)").Group("channel_id, model_name")
	err := DB.Where("id IN (?)", sub).Find(&runs).Error
	return runs, err
}

// GetPreviousIQTestRun returns the newest run for the same channel+model
// before the given run id (used for score-drop detection).
func GetPreviousIQTestRun(channelId int, modelName string, beforeId int) (*IQTestRun, error) {
	var run IQTestRun
	err := DB.Where("channel_id = ? AND model_name = ? AND id < ?", channelId, modelName, beforeId).
		Order("id desc").First(&run).Error
	if err != nil {
		return nil, err
	}
	return &run, nil
}
