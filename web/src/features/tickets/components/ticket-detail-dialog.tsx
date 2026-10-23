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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatTimestampToDate } from '@/lib/format'

import { getTicketDetail, replyTicket, updateTicketStatus } from '../api'
import {
  getCategoryLabelKey,
  TICKET_PRIORITY_CONFIG,
  TICKET_STATUS_CONFIG,
} from '../constants'
import type { TicketDetail } from '../types'

interface TicketDetailDialogProps {
  ticketId: number | null
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function TicketDetailDialog(props: TicketDetailDialogProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (props.ticketId === null) return
    setLoading(true)
    try {
      const res = await getTicketDetail(props.ticketId)
      if (res.success && res.data) {
        setDetail(res.data)
      } else {
        toast.error(res.message || t('Failed to load ticket'))
      }
    } catch {
      toast.error(t('Failed to load ticket'))
    } finally {
      setLoading(false)
    }
  }, [props.ticketId, t])

  useEffect(() => {
    if (props.ticketId !== null) {
      setDetail(null)
      setReply('')
      load()
    }
  }, [props.ticketId, load])

  const handleReply = async () => {
    if (props.ticketId === null || !reply.trim()) return
    setSending(true)
    try {
      const res = await replyTicket(props.ticketId, reply.trim())
      if (res.success) {
        toast.success(t('Reply sent'))
        setReply('')
        await load()
        props.onChanged()
      } else {
        toast.error(res.message || t('Failed to send reply'))
      }
    } catch {
      toast.error(t('Failed to send reply'))
    } finally {
      setSending(false)
    }
  }

  const handleStatus = async (status: number) => {
    if (props.ticketId === null) return
    try {
      const res = await updateTicketStatus(props.ticketId, status)
      if (res.success) {
        toast.success(t('Status updated'))
        await load()
        props.onChanged()
      } else {
        toast.error(res.message || t('Failed to update status'))
      }
    } catch {
      toast.error(t('Failed to update status'))
    }
  }

  const ticket = detail?.ticket
  const statusCfg = ticket ? TICKET_STATUS_CONFIG[ticket.status] : undefined
  const priorityCfg = ticket
    ? TICKET_PRIORITY_CONFIG[ticket.priority]
    : undefined
  const closed = ticket?.status === 2

  return (
    <Dialog
      open={props.ticketId !== null}
      onOpenChange={props.onOpenChange}
      title={ticket ? `#${ticket.id} ${ticket.title}` : t('Ticket Detail')}
      footer={
        ticket && !closed ? (
          <>
            {props.isAdmin && ticket.status === 0 && (
              <Button variant='outline' onClick={() => handleStatus(1)}>
                {t('Mark as Replied')}
              </Button>
            )}
            <Button variant='outline' onClick={() => handleStatus(2)}>
              {t('Close Ticket')}
            </Button>
          </>
        ) : undefined
      }
    >
      {loading || !ticket ? (
        <p className='text-muted-foreground py-6 text-center text-sm'>
          {t('Loading...')}
        </p>
      ) : (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            {statusCfg && (
              <Badge variant={statusCfg.variant}>{t(statusCfg.labelKey)}</Badge>
            )}
            {priorityCfg && (
              <Badge variant={priorityCfg.variant}>
                {t(priorityCfg.labelKey)}
              </Badge>
            )}
            <Badge variant='outline'>
              {t(getCategoryLabelKey(ticket.category))}
            </Badge>
            <span className='text-muted-foreground'>
              {ticket.username} · {formatTimestampToDate(ticket.created_at)}
            </span>
          </div>

          <div className='flex flex-col gap-3'>
            <div className='bg-muted/50 rounded-lg p-3'>
              <p className='mb-1 text-xs font-medium'>
                {ticket.username}
                <span className='text-muted-foreground ml-2'>
                  {formatTimestampToDate(ticket.created_at)}
                </span>
              </p>
              <p className='text-sm whitespace-pre-wrap'>{ticket.content}</p>
            </div>
            {detail?.replies.map((item) => (
              <div
                key={item.id}
                className={
                  item.is_admin
                    ? 'rounded-lg bg-blue-500/10 p-3'
                    : 'bg-muted/50 rounded-lg p-3'
                }
              >
                <p className='mb-1 text-xs font-medium'>
                  {item.username}
                  {item.is_admin && (
                    <Badge variant='secondary' className='ml-2'>
                      {t('Support')}
                    </Badge>
                  )}
                  <span className='text-muted-foreground ml-2'>
                    {formatTimestampToDate(item.created_at)}
                  </span>
                </p>
                <p className='text-sm whitespace-pre-wrap'>{item.content}</p>
              </div>
            ))}
          </div>

          {!closed && (
            <div className='flex flex-col gap-2'>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t('Write a reply...')}
                rows={3}
                maxLength={10000}
              />
              <div className='flex justify-end'>
                <Button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                >
                  {sending ? t('Sending...') : t('Reply')}
                </Button>
              </div>
            </div>
          )}
          {closed && (
            <p className='text-muted-foreground text-center text-sm'>
              {t('This ticket is closed')}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
