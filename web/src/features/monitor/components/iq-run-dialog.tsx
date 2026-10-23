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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import { runIQTest } from '../api'
import type { MonitorChannelItem } from '../types'

interface IQRunDialogProps {
  channel: MonitorChannelItem | null
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

export function IQRunDialog(props: IQRunDialogProps) {
  const { t } = useTranslation()
  const channel = props.channel
  const [model, setModel] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (channel) {
      setModel(channel.test_model || channel.models[0] || '')
    }
  }, [channel])

  const handleRun = async () => {
    if (!channel) return
    if (!model) {
      toast.error(t('Please select a model'))
      return
    }
    setRunning(true)
    try {
      const res = await runIQTest(channel.id, model)
      if (res.success && res.data) {
        toast.success(`${t('IQ test finished')}: ${res.data.score} / 100`)
        props.onOpenChange(false)
        props.onDone()
      } else {
        toast.error(res.message || t('IQ test failed'))
      }
    } catch {
      toast.error(t('IQ test failed'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog
      open={channel !== null}
      onOpenChange={(open) => {
        if (!running) props.onOpenChange(open)
      }}
      title={t('Run IQ Test')}
      description={
        channel
          ? `${channel.name} · ${t('The model answers a fixed set of probe questions and is scored automatically. This may take a few minutes.')}`
          : undefined
      }
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={running}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleRun} disabled={running || !model}>
            {running ? t('Testing...') : t('Start Test')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='iq-model'>{t('Model')}</Label>
          <NativeSelect
            id='iq-model'
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {(channel?.models ?? []).map((m) => (
              <NativeSelectOption key={m} value={m}>
                {m}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </Dialog>
  )
}
