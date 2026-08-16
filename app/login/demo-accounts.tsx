'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';

/**
 * Demo 帐号快捷参考。
 *
 * 只在 NEXT_PUBLIC_DEMO_MODE=true 时渲染。
 * 正式部署必须把该变量设为 false，并按 README 说明重置全部种子密码。
 */

const ACCOUNTS = [
  { role: '超级管理员', phone: '13800000001', desc: '全部权限，含系统配置与操作日志' },
  { role: '运营', phone: '13800000002', desc: '日常业务全流程，但看不到系统配置' },
  { role: '服务督导', phone: '13800000003', desc: '培训、质控、服务审核、事件处理' },
  { role: '财务', phone: '13800000004', desc: '只看订单与订阅，看不到长辈生活记录' },
  { role: '家庭安心专员（李晨）', phone: '13800000011', desc: '专员工作台，只见自己负责的家庭' },
  { role: '家庭安心专员（周敏）', phone: '13800000012', desc: '用于验证专员之间的数据隔离' },
  { role: '家庭成员（王女士）', phone: '13800000021', desc: '王家付费子女，已获授权' },
  { role: '家庭成员（王先生）', phone: '13800000022', desc: '王家儿子，仅部分授权，用于验证授权差异' },
  { role: '家庭成员（刘先生）', phone: '13800000031', desc: '刘家，用于验证家庭之间的数据隔离' },
];

const PASSWORD = 'Demo@2026';

export function DemoAccounts() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // 剪贴板不可用时静默失败，用户仍可手动输入
    }
  }

  return (
    <div className="mt-5 rounded-card border border-warm-200 bg-warm-50/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-medium text-warm-700">
          演示帐号（仅本地 Demo 环境）
        </span>
        <ChevronDown
          className={`h-4 w-4 text-warm-600 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="border-t border-warm-200 px-4 py-3">
          <p className="mb-3 text-xs leading-relaxed text-warm-700">
            统一密码 <code className="rounded bg-white px-1 py-0.5 font-mono">{PASSWORD}</code>
            。这些帐号只适用于本地演示，正式部署不得使用固定 Demo 密码。
          </p>
          <ul className="space-y-1.5">
            {ACCOUNTS.map((a) => (
              <li
                key={a.phone}
                className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-700">{a.role}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{a.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(a.phone)}
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 font-mono text-[11px] text-ink-500 hover:bg-cream-200 hover:text-ink-700"
                  title="复制手机号"
                >
                  {copied === a.phone ? (
                    <Check className="h-3 w-3 text-brand-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {a.phone}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
