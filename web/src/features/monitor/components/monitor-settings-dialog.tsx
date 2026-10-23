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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { getMonitorSettings, updateMonitorSettings } from '../api'
import type { MonitorSettings } from '../types'

interface MonitorSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MonitorSettingsDialog(props: MonitorSettingsDialogProps) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<MonitorSettings>({
    probe_enabled: false,
    probe_interval_minutes: 30,
    iq_drop_threshold: 20,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!props.open) return
    void (async () => {
      try {
        const res = await getMonitorSettings()
        if (res.success && res.data) setSettings(res.data)
      } catch {
        toast.error(t('Failed to load settings'))
      }
    })()
  }, [props.open, t])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateMonitorSettings(settings)
      if (res.success) {
        toast.success(t('Settings saved'))
        props.onOpenChange(false)
      } else {
        toast.error(res.message || t('Failed to save settings'))
      }
    } catch {
      toast.error(t('Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Monitor Settings')}
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={saving}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between gap-4'>
          <Label htmlFor='monitor-probe-enabled'>{t('Auto Probe')}</Label>
          <Switch
            id='monitor-probe-enabled'
            checked={settings.probe_enabled}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, probe_enabled: checked }))
            }
          />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='monitor-probe-interval'>
            {t('Probe Interval (minutes)')}
          </Label>
          <Input
            id='monitor-probe-interval'
            type='number'
            min={1}
            max={1440}
            value={settings.probe_interval_minutes}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                probe_interval_minutes: Number(e.target.value),
              }))
            }
          />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='monitor-iq-threshold'>
            {t('IQ Drop Threshold (points)')}
          </Label>
          <Input
            id='monitor-iq-threshold'
            type='number'
            min={1}
            max={100}
            value={settings.iq_drop_threshold}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                iq_drop_threshold: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
    </Dialog>
  )
}
