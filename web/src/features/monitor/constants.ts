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

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusMeta {
  labelKey: string
  variant: BadgeVariant
}

export const PROBE_STATUS_CONFIG: Record<number, StatusMeta> = {
  0: { labelKey: 'Down', variant: 'destructive' },
  1: { labelKey: 'Healthy', variant: 'default' },
  2: { labelKey: 'Slow', variant: 'secondary' },
  3: { labelKey: 'Very Slow', variant: 'secondary' },
}

export const IQ_VERDICT_CONFIG: Record<number, StatusMeta> = {
  0: { labelKey: 'Normal', variant: 'default' },
  1: { labelKey: 'Warning', variant: 'secondary' },
  2: { labelKey: 'Suspected Downgrade', variant: 'destructive' },
  3: { labelKey: 'Test Failed', variant: 'destructive' },
}

export function scoreVariant(score: number): BadgeVariant {
  if (score >= 80) return 'default'
  if (score >= 60) return 'secondary'
  return 'destructive'
}
