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
// Custom 二次开发：工单功能（见仓库根目录 CUSTOM.md）
import { api } from '@/lib/api'

import type {
  ApiResponse,
  CreateTicketData,
  GetTicketsParams,
  Ticket,
  TicketDetail,
  TicketListData,
  TicketReply,
} from './types'

// 工单列表：scope=self 只看自己的；scope=all 管理员看全部
export async function getTickets(
  params: GetTicketsParams
): Promise<ApiResponse<TicketListData>> {
  const { scope, status, keyword = '', p = 1, page_size = 10 } = params
  const query = new URLSearchParams()
  if (status !== undefined) query.set('status', String(status))
  if (keyword) query.set('keyword', keyword)
  query.set('p', String(p))
  query.set('page_size', String(page_size))
  const url =
    scope === 'all'
      ? `/api/ticket/?${query.toString()}`
      : `/api/ticket/self?${query.toString()}`
  const res = await api.get(url)
  return res.data
}

export async function createTicket(
  data: CreateTicketData
): Promise<ApiResponse<Ticket>> {
  const res = await api.post('/api/ticket/', data)
  return res.data
}

export async function getTicketDetail(
  id: number
): Promise<ApiResponse<TicketDetail>> {
  const res = await api.get(`/api/ticket/${id}`)
  return res.data
}

export async function replyTicket(
  id: number,
  content: string
): Promise<ApiResponse<TicketReply>> {
  const res = await api.post(`/api/ticket/${id}/reply`, { content })
  return res.data
}

export async function updateTicketStatus(
  id: number,
  status: number
): Promise<ApiResponse> {
  const res = await api.put(`/api/ticket/${id}/status`, { status })
  return res.data
}
