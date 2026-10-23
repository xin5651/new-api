package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// MonitorCenterSetting 监控中心配置（custom 二开）：渠道定时探测 + 智商测试掉分阈值。
type MonitorCenterSetting struct {
	ProbeEnabled         bool `json:"probe_enabled"`          // 是否启用定时探测全部启用中渠道
	ProbeIntervalMinutes int  `json:"probe_interval_minutes"` // 定时探测间隔（分钟）
	IQDropThreshold      int  `json:"iq_drop_threshold"`      // 智商得分较上次下降达到该分值时标记掉分预警
}

// 默认配置
var monitorCenterSetting = MonitorCenterSetting{
	ProbeEnabled:         false,
	ProbeIntervalMinutes: 30,
	IQDropThreshold:      20,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_center_setting", &monitorCenterSetting)
}

// GetMonitorCenterSetting 获取监控中心配置（带边界修正）
func GetMonitorCenterSetting() *MonitorCenterSetting {
	if monitorCenterSetting.ProbeIntervalMinutes < 1 {
		monitorCenterSetting.ProbeIntervalMinutes = 30
	}
	if monitorCenterSetting.ProbeIntervalMinutes > 1440 {
		monitorCenterSetting.ProbeIntervalMinutes = 1440
	}
	if monitorCenterSetting.IQDropThreshold < 1 {
		monitorCenterSetting.IQDropThreshold = 20
	}
	if monitorCenterSetting.IQDropThreshold > 100 {
		monitorCenterSetting.IQDropThreshold = 100
	}
	return &monitorCenterSetting
}
