import { Activity, BrainCircuit, Gauge, Settings2 } from 'lucide-react'
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
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestampToDate } from '@/lib/format'

import {
  getIQTestRuns,
  getMonitorChannels,
  getMonitorOverview,
  probeAllChannels,
  probeChannel,
} from './api'
import { IQDetailDialog } from './components/iq-detail-dialog'
import { IQRunDialog } from './components/iq-run-dialog'
import { MonitorSettingsDialog } from './components/monitor-settings-dialog'
import {
  IQ_VERDICT_CONFIG,
  PROBE_STATUS_CONFIG,
  scoreVariant,
} from './constants'
import type { IQTestRun, MonitorChannelItem, MonitorOverview } from './types'

const PAGE_SIZE = 10

interface ChannelStatusListProps {
  channels: MonitorChannelItem[]
  probingIds: Set<number>
  onProbe: (channel: MonitorChannelItem) => void
  onIQTest: (channel: MonitorChannelItem) => void
}

function ChannelStatusList(props: ChannelStatusListProps) {
  const { t } = useTranslation()
  if (props.channels.length === 0) {
    return <EmptyState title={t('No channels yet')} />
  }
  return (
    <div className='flex flex-col gap-2'>
      {props.channels.map((channel) => {
        const probeMeta = channel.probe
          ? PROBE_STATUS_CONFIG[channel.probe.status]
          : undefined
        return (
          <Card key={channel.id} className='p-3 sm:p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-sm'>
                #{channel.id}
              </span>
              <span className='font-medium'>{channel.name}</span>
              {channel.status !== 1 ? (
                <Badge variant='outline'>{t('Disabled')}</Badge>
              ) : null}
              {probeMeta ? (
                <Badge variant={probeMeta.variant}>
                  {t(probeMeta.labelKey)}
                </Badge>
              ) : (
                <Badge variant='outline'>{t('Not Probed')}</Badge>
              )}
              {channel.probe ? (
                <span className='text-muted-foreground text-xs'>
                  {channel.probe.model_name} · {channel.probe.latency_ms} ms ·{' '}
                  {formatTimestampToDate(channel.probe.created_at)}
                </span>
              ) : null}
              <div className='ml-auto flex items-center gap-2'>
                {channel.iq ? (
                  <Badge variant={scoreVariant(channel.iq.score)}>
                    {t('IQ')}: {channel.iq.score}
                  </Badge>
                ) : null}
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => props.onProbe(channel)}
                  disabled={props.probingIds.has(channel.id)}
                >
                  {props.probingIds.has(channel.id)
                    ? t('Probing...')
                    : t('Probe')}
                </Button>
                <Button size='sm' onClick={() => props.onIQTest(channel)}>
                  <BrainCircuit className='mr-1 h-4 w-4' />
                  {t('IQ Test')}
                </Button>
              </div>
            </div>
            {channel.probe?.error ? (
              <p className='text-destructive mt-2 line-clamp-2 text-xs'>
                {channel.probe.error}
              </p>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

interface IQRunListProps {
  runs: IQTestRun[]
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelect: (run: IQTestRun) => void
}

function IQRunList(props: IQRunListProps) {
  const { t } = useTranslation()
  if (props.runs.length === 0) {
    return <EmptyState title={t('No IQ test records yet')} />
  }
  return (
    <div className='flex flex-col gap-2'>
      {props.runs.map((run) => {
        const verdict = IQ_VERDICT_CONFIG[run.verdict]
        return (
          <Card
            key={run.id}
            className='hover:bg-accent/50 cursor-pointer p-3 sm:p-4'
            onClick={() => props.onSelect(run)}
          >
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium'>{run.channel_name}</span>
              <span className='text-muted-foreground text-sm'>
                {run.model_name}
              </span>
              <Badge variant={scoreVariant(run.score)}>
                {t('Score')}: {run.score}
              </Badge>
              <Badge variant='outline'>
                {t('Passed')} {run.passed}/{run.total}
              </Badge>
              {verdict ? (
                <Badge variant={verdict.variant}>{t(verdict.labelKey)}</Badge>
              ) : null}
              {run.drop_alert ? (
                <Badge variant='destructive'>{t('Score Drop Alert')}</Badge>
              ) : null}
              <span className='text-muted-foreground ml-auto text-xs'>
                {formatTimestampToDate(run.created_at)}
              </span>
            </div>
          </Card>
        )
      })}
      <div className='flex items-center justify-end gap-2 pt-1'>
        <Button
          variant='outline'
          size='sm'
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          {t('Previous')}
        </Button>
        <span className='text-muted-foreground text-xs'>
          {props.page} / {props.totalPages}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          {t('Next')}
        </Button>
      </div>
    </div>
  )
}

export function MonitorCenter() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('channels')
  const [overview, setOverview] = useState<MonitorOverview | null>(null)
  const [channels, setChannels] = useState<MonitorChannelItem[]>([])
  const [runs, setRuns] = useState<IQTestRun[]>([])
  const [runsTotal, setRunsTotal] = useState(0)
  const [runsPage, setRunsPage] = useState(1)
  const [probingIds, setProbingIds] = useState<Set<number>>(new Set())
  const [probingAll, setProbingAll] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [iqChannel, setIqChannel] = useState<MonitorChannelItem | null>(null)
  const [selectedRun, setSelectedRun] = useState<IQTestRun | null>(null)

  const loadOverview = useCallback(async () => {
    try {
      const res = await getMonitorOverview()
      if (res.success && res.data) setOverview(res.data)
    } catch {
      // overview is best-effort; the tabs below carry their own errors
    }
  }, [])

  const loadChannels = useCallback(async () => {
    try {
      const res = await getMonitorChannels()
      if (res.success && res.data) {
        setChannels(res.data)
      } else {
        toast.error(res.message || t('Failed to load channels'))
      }
    } catch {
      toast.error(t('Failed to load channels'))
    }
  }, [t])

  const loadRuns = useCallback(async () => {
    try {
      const res = await getIQTestRuns({ p: runsPage, page_size: PAGE_SIZE })
      if (res.success && res.data) {
        setRuns(res.data.items ?? [])
        setRunsTotal(res.data.total)
      }
    } catch {
      toast.error(t('Failed to load IQ test records'))
    }
  }, [runsPage, t])

  useEffect(() => {
    void loadOverview()
    void loadChannels()
  }, [loadOverview, loadChannels])

  useEffect(() => {
    if (tab === 'iq') void loadRuns()
  }, [tab, loadRuns])

  const handleProbe = async (channel: MonitorChannelItem) => {
    setProbingIds((prev) => new Set(prev).add(channel.id))
    try {
      const res = await probeChannel(channel.id)
      if (res.success) {
        toast.success(t('Probe finished'))
        await loadChannels()
        await loadOverview()
      } else {
        toast.error(res.message || t('Probe failed'))
      }
    } catch {
      toast.error(t('Probe failed'))
    } finally {
      setProbingIds((prev) => {
        const next = new Set(prev)
        next.delete(channel.id)
        return next
      })
    }
  }

  const handleProbeAll = async () => {
    setProbingAll(true)
    try {
      const res = await probeAllChannels()
      if (res.success) {
        toast.success(t('Probing all channels in the background'))
      } else {
        toast.error(res.message || t('Probe failed'))
      }
    } catch {
      toast.error(t('Probe failed'))
    } finally {
      setProbingAll(false)
    }
  }

  const health = overview?.health
  const totalPages = Math.max(1, Math.ceil(runsTotal / PAGE_SIZE))

  let tabContent: ReactNode
  if (tab === 'channels') {
    tabContent = (
      <ChannelStatusList
        channels={channels}
        probingIds={probingIds}
        onProbe={handleProbe}
        onIQTest={setIqChannel}
      />
    )
  } else {
    tabContent = (
      <IQRunList
        runs={runs}
        page={runsPage}
        totalPages={totalPages}
        onPageChange={setRunsPage}
        onSelect={setSelectedRun}
      />
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='flex items-center gap-2'>
          <Activity className='h-5 w-5' />
          {t('Monitor Center')}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' onClick={() => setSettingsOpen(true)}>
          <Settings2 className='mr-1 h-4 w-4' />
          {t('Monitor Settings')}
        </Button>
        <Button onClick={handleProbeAll} disabled={probingAll}>
          <Gauge className='mr-1 h-4 w-4' />
          {t('Probe All')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <Card className='p-4'>
              <div className='text-muted-foreground text-xs'>
                {t('Today Requests')}
              </div>
              <div className='mt-1 text-2xl font-semibold'>
                {overview?.today_requests ?? '-'}
              </div>
            </Card>
            <Card className='p-4'>
              <div className='text-muted-foreground text-xs'>
                {t('Today Tokens')}
              </div>
              <div className='mt-1 text-2xl font-semibold'>
                {overview?.today_tokens ?? '-'}
              </div>
            </Card>
            <Card className='p-4'>
              <div className='text-muted-foreground text-xs'>
                {t('Error Rate')}
              </div>
              <div className='mt-1 text-2xl font-semibold'>
                {overview ? `${overview.error_rate.toFixed(1)}%` : '-'}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Today Errors')}: {overview?.today_errors ?? '-'}
              </div>
            </Card>
            <Card className='p-4'>
              <div className='text-muted-foreground text-xs'>
                {t('Channel Health')}
              </div>
              <div className='mt-1 text-2xl font-semibold'>
                {health
                  ? `${health.healthy}/${overview?.channels_enabled ?? 0}`
                  : '-'}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Down')}: {health?.down ?? 0} · {t('Slow')}:{' '}
                {(health?.slow ?? 0) + (health?.very_slow ?? 0)}
              </div>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value='channels'>{t('Channel Status')}</TabsTrigger>
              <TabsTrigger value='iq'>{t('IQ Test Records')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {tabContent}
        </div>
      </SectionPageLayout.Content>

      <MonitorSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <IQRunDialog
        channel={iqChannel}
        onOpenChange={(open) => {
          if (!open) setIqChannel(null)
        }}
        onDone={() => {
          void loadChannels()
          setTab('iq')
        }}
      />
      <IQDetailDialog
        run={selectedRun}
        onOpenChange={(open) => {
          if (!open) setSelectedRun(null)
        }}
      />
    </SectionPageLayout>
  )
}
