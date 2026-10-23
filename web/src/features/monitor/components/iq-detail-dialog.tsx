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
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'

import { IQ_VERDICT_CONFIG, scoreVariant } from '../constants'
import type { IQDetailItem, IQTestRun } from '../types'

interface IQDetailDialogProps {
  run: IQTestRun | null
  onOpenChange: (open: boolean) => void
}

export function IQDetailDialog(props: IQDetailDialogProps) {
  const { t } = useTranslation()
  const run = props.run

  let items: IQDetailItem[] = []
  if (run?.details) {
    try {
      items = JSON.parse(run.details) as IQDetailItem[]
    } catch {
      items = []
    }
  }
  const verdict = run ? IQ_VERDICT_CONFIG[run.verdict] : undefined

  return (
    <Dialog
      open={run !== null}
      onOpenChange={props.onOpenChange}
      title={run ? `${run.channel_name} · ${run.model_name}` : ''}
      description={run ? formatTimestampToDate(run.created_at) : undefined}
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      {run ? (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-2'>
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
          </div>
          <div className='flex flex-col gap-2'>
            {items.map((item) => (
              <div
                key={item.id}
                className='flex flex-col gap-1 rounded-lg border p-3'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>{item.prompt}</span>
                  <Badge variant={item.passed ? 'default' : 'destructive'}>
                    {item.passed ? t('Passed') : t('Failed')}
                  </Badge>
                </div>
                <span className='text-muted-foreground text-xs'>
                  {t('Expected')}: {item.expected}
                  {item.error
                    ? ` · ${item.error}`
                    : ` · ${t('Answer')}: ${item.answer || '-'}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
