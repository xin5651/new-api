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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import { createTicket } from '../api'
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_CONFIG } from '../constants'

interface TicketCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function TicketCreateDialog(props: TicketCreateDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [priority, setPriority] = useState('1')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t('Please enter a title'))
      return
    }
    if (!content.trim()) {
      toast.error(t('Please describe your issue'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createTicket({
        title: title.trim(),
        category,
        priority: Number(priority),
        content: content.trim(),
      })
      if (res.success) {
        toast.success(t('Ticket submitted'))
        setTitle('')
        setContent('')
        setCategory('other')
        setPriority('1')
        props.onOpenChange(false)
        props.onCreated()
      } else {
        toast.error(res.message || t('Failed to submit ticket'))
      }
    } catch {
      toast.error(t('Failed to submit ticket'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('New Ticket')}
      description={t('Describe your issue and we will get back to you')}
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Submitting...') : t('Submit')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='ticket-title'>{t('Title')}</Label>
          <Input
            id='ticket-title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Brief summary of your issue')}
            maxLength={200}
          />
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='ticket-category'>{t('Category')}</Label>
            <NativeSelect
              id='ticket-category'
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className='w-full'
            >
              {TICKET_CATEGORY_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='ticket-priority'>{t('Priority')}</Label>
            <NativeSelect
              id='ticket-priority'
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className='w-full'
            >
              {Object.entries(TICKET_PRIORITY_CONFIG).map(([value, cfg]) => (
                <NativeSelectOption key={value} value={value}>
                  {t(cfg.labelKey)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='ticket-content'>{t('Content')}</Label>
          <Textarea
            id='ticket-content'
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('Please describe your issue in detail')}
            rows={6}
            maxLength={10000}
          />
        </div>
      </div>
    </Dialog>
  )
}
