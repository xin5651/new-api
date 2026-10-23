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
// Custom 二次开发：监控中心（见仓库根目录 CUSTOM.md）
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ChannelProbe {
  id: number
  channel_id: number
  channel_name: string
  model_name: string
  status: number // 0: down, 1: healthy, 2: slow, 3: very slow
  latency_ms: number
  error: string
  created_at: number
}

export interface IQDetailItem {
  id: string
  category: string
  prompt: string
  expected: string
  answer: string
  passed: boolean
  latency_ms: number
  error?: string
}

export interface IQTestRun {
  id: number
  channel_id: number
  channel_name: string
  model_name: string
  score: number
  passed: number
  total: number
  avg_latency_ms: number
  verdict: number // 0: ok, 1: warning, 2: suspected downgrade, 3: failed
  drop_alert: boolean
  details: string // JSON array of IQDetailItem
  created_by: number
  created_at: number
}

export interface MonitorChannelItem {
  id: number
  name: string
  type: number
  status: number
  group: string
  models: string[]
  test_model: string
  probe: ChannelProbe | null
  iq: IQTestRun | null
}

export interface MonitorOverview {
  today_requests: number
  today_quota: number
  today_tokens: number
  today_errors: number
  error_rate: number
  channels_total: number
  channels_enabled: number
  health: {
    healthy: number
    slow: number
    very_slow: number
    down: number
  }
  latest_probes: ChannelProbe[]
  latest_iq_runs: IQTestRun[]
}

export interface MonitorSettings {
  probe_enabled: boolean
  probe_interval_minutes: number
  iq_drop_threshold: number
}

export interface PageData<T> {
  items: T[]
  total: number
}
