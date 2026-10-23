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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  ChannelProbe,
  IQTestRun,
  MonitorChannelItem,
  MonitorOverview,
  MonitorSettings,
  PageData,
} from './types'

export async function getMonitorOverview(): Promise<
  ApiResponse<MonitorOverview>
> {
  const res = await api.get('/api/monitor/overview')
  return res.data
}

export async function getMonitorChannels(): Promise<
  ApiResponse<MonitorChannelItem[]>
> {
  const res = await api.get('/api/monitor/channels')
  return res.data
}

export async function probeChannel(
  channelId: number,
  model?: string
): Promise<ApiResponse<ChannelProbe>> {
  const res = await api.post(`/api/monitor/probe/${channelId}`, {
    model: model ?? '',
  })
  return res.data
}

export async function probeAllChannels(): Promise<ApiResponse> {
  const res = await api.post('/api/monitor/probe-all')
  return res.data
}

export async function runIQTest(
  channelId: number,
  model: string
): Promise<ApiResponse<IQTestRun>> {
  const res = await api.post('/api/monitor/iq/run', {
    channel_id: channelId,
    model,
  })
  return res.data
}

export async function getIQTestRuns(params: {
  channel_id?: number
  p?: number
  page_size?: number
}): Promise<ApiResponse<PageData<IQTestRun>>> {
  const query = new URLSearchParams()
  if (params.channel_id) query.set('channel_id', String(params.channel_id))
  query.set('p', String(params.p ?? 1))
  query.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(`/api/monitor/iq/runs?${query.toString()}`)
  return res.data
}

export async function getMonitorSettings(): Promise<
  ApiResponse<MonitorSettings>
> {
  const res = await api.get('/api/monitor/settings')
  return res.data
}

export async function updateMonitorSettings(
  settings: MonitorSettings
): Promise<ApiResponse<MonitorSettings>> {
  const res = await api.put('/api/monitor/settings', settings)
  return res.data
}
