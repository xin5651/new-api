import { LifeBuoy, Plus, Search } from 'lucide-react'
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
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatTimestampToDate } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getTickets } from './api'
import { TicketCreateDialog } from './components/ticket-create-dialog'
import { TicketDetailDialog } from './components/ticket-detail-dialog'
import {
  getCategoryLabelKey,
  TICKET_PRIORITY_CONFIG,
  TICKET_STATUS_CONFIG,
} from './constants'
import type { Ticket } from './types'

const PAGE_SIZE = 10

export function Tickets() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = (user?.role ?? 0) >= ROLE.ADMIN

  const [scope, setScope] = useState<'self' | 'all'>('self')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTickets({
        scope,
        status: statusFilter === '' ? undefined : Number(statusFilter),
        keyword: keyword.trim(),
        p: page,
        page_size: PAGE_SIZE,
      })
      if (res.success && res.data) {
        setTickets(res.data.items ?? [])
        setTotal(res.data.total)
      } else {
        toast.error(res.message || t('Failed to load tickets'))
      }
    } catch {
      toast.error(t('Failed to load tickets'))
    } finally {
      setLoading(false)
    }
  }, [scope, statusFilter, keyword, page, t])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  let listContent: ReactNode
  if (loading) {
    listContent = (
      <p className='text-muted-foreground py-10 text-center text-sm'>
        {t('Loading...')}
      </p>
    )
  } else if (tickets.length === 0) {
    listContent = (
      <EmptyState
        icon={LifeBuoy}
        title={t('No tickets yet')}
        description={t(
          'If you run into any issue, submit a ticket and we will get back to you'
        )}
        action={
          <Button onClick={() => setCreateOpen(true)}>{t('New Ticket')}</Button>
        }
      />
    )
  } else {
    listContent = (
      <div className='flex flex-col gap-2'>
        {tickets.map((ticket) => {
          const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
          const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]
          return (
            <Card
              key={ticket.id}
              className='hover:bg-muted/40 cursor-pointer p-4 transition-colors'
              onClick={() => setSelectedId(ticket.id)}
            >
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-muted-foreground text-sm'>
                  #{ticket.id}
                </span>
                <span className='font-medium'>{ticket.title}</span>
                {statusCfg && (
                  <Badge variant={statusCfg.variant}>
                    {t(statusCfg.labelKey)}
                  </Badge>
                )}
                {priorityCfg && (
                  <Badge variant={priorityCfg.variant}>
                    {t(priorityCfg.labelKey)}
                  </Badge>
                )}
                <Badge variant='outline'>
                  {t(getCategoryLabelKey(ticket.category))}
                </Badge>
                <span className='text-muted-foreground ml-auto text-xs'>
                  {scope === 'all' && `${ticket.username} · `}
                  {t('Updated')} {formatTimestampToDate(ticket.updated_at)}
                  {ticket.reply_count > 0 &&
                    ` · ${ticket.reply_count} ${t('replies')}`}
                </span>
              </div>
            </Card>
          )
        })}
        {totalPages > 1 && (
          <div className='flex items-center justify-end gap-2 pt-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('Previous')}
            </Button>
            <span className='text-sm'>
              {page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='flex items-center gap-2'>
          <LifeBuoy className='h-5 w-5' />
          {t('Support Tickets')}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-2'>
            {isAdmin && (
              <>
                <Button
                  variant={scope === 'self' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setScope('self')
                    setPage(1)
                  }}
                >
                  {t('My Tickets')}
                </Button>
                <Button
                  variant={scope === 'all' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setScope('all')
                    setPage(1)
                  }}
                >
                  {t('All Tickets')}
                </Button>
              </>
            )}
            <div className='relative'>
              <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
              <Input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder={t('Search tickets')}
                className='w-52 pl-8'
              />
            </div>
            <NativeSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              aria-label={t('Status')}
            >
              <NativeSelectOption value=''>
                {t('All Statuses')}
              </NativeSelectOption>
              {Object.entries(TICKET_STATUS_CONFIG).map(([value, cfg]) => (
                <NativeSelectOption key={value} value={value}>
                  {t(cfg.labelKey)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className='ml-auto'>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className='mr-1 h-4 w-4' />
                {t('New Ticket')}
              </Button>
            </div>
          </div>

          {listContent}
        </div>
      </SectionPageLayout.Content>

      <TicketCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <TicketDetailDialog
        ticketId={selectedId}
        isAdmin={isAdmin}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        onChanged={load}
      />
    </SectionPageLayout>
  )
}
