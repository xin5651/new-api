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
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface Ticket {
  id: number
  user_id: number
  username: string
  title: string
  category: string
  priority: number // 0: low, 1: normal, 2: high
  status: number // 0: open, 1: replied, 2: closed
  content: string
  created_at: number
  updated_at: number
  reply_count: number
}

export interface TicketReply {
  id: number
  ticket_id: number
  user_id: number
  username: string
  is_admin: boolean
  content: string
  created_at: number
}

export interface TicketDetail {
  ticket: Ticket
  replies: TicketReply[]
}

export interface TicketListData {
  page: number
  page_size: number
  total: number
  items: Ticket[]
}

export interface CreateTicketData {
  title: string
  category: string
  priority: number
  content: string
}

export interface GetTicketsParams {
  scope: 'self' | 'all'
  status?: number
  keyword?: string
  p?: number
  page_size?: number
}
