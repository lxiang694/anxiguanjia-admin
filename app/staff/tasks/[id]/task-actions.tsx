'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Loader2, MapPin, Play, X } from 'lucide-react';

import {
  acceptTaskAction,
  checkInAction,
  declineTaskAction,
  markNotCompletedAction,
  startServiceAction,
  type ActionState,
} from '@/app/actions/staff';
import { ErrorNotice } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * 任务动作区。
 *
 * 一线操作原则：一屏之内只呈现「现在该点哪一个」，其余动作收在次要位置。
 * 大按钮 + 少步骤，避免在长辈家门口反复翻页。
 */

function BigButton({
  children,
  tone = 'brand',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'warm' | 'danger' | 'secondary';
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const tones = {
    brand: 'bg-brand-700 text-white active:bg-brand-800',
    warm: 'bg-warm-400 text-white active:bg-warm-500',
    danger: 'bg-danger-600 text-white active:bg-danger-700',
    secondary: 'border border-cream-400 bg-white text-ink-700 active:bg-cream-100',
  };
  return (
    <button type="submit" disabled={pending} className={cn('btn-mobile', tones[tone])}>
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function TaskActions({
  taskId,
  status,
  hasRecord,
}: {
  taskId: string;
  status: string;
  hasRecord: boolean;
}) {
  const [acceptState, accept] = useActionState<ActionState, FormData>(acceptTaskAction, null);
  const [checkInState, checkIn] = useActionState<ActionState, FormData>(checkInAction, null);
  const [startState, start] = useActionState<ActionState, FormData>(startServiceAction, null);
  const [declineState, decline] = useActionState<ActionState, FormData>(declineTaskAction, null);
  const [notDoneState, notDone] = useActionState<ActionState, FormData>(
    markNotCompletedAction,
    null,
  );

  const [showDecline, setShowDecline] = useState(false);
  const [showNotDone, setShowNotDone] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const error =
    acceptState?.error ??
    checkInState?.error ??
    startState?.error ??
    declineState?.error ??
    notDoneState?.error;

  function locate() {
    if (!('geolocation' in navigator)) {
      setLocError('这台设备不支持定位，可以直接签到，不影响服务。');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      () => {
        setLocError('没有取到位置（室内常见）。可以直接签到，不影响服务。');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorNotice title="操作没有完成" message={error} /> : null}

      {/* 已派单 → 接受 / 拒绝 */}
      {status === 'ASSIGNED' ? (
        <>
          <form action={accept}>
            <input type="hidden" name="taskId" value={taskId} />
            <BigButton icon={<Check className="h-5 w-5" />}>接受这次任务</BigButton>
          </form>

          {showDecline ? (
            <form action={decline} className="card space-y-2 px-4 py-4">
              <input type="hidden" name="taskId" value={taskId} />
              <label className="label" htmlFor="declineReason">
                无法前往的原因
              </label>
              <textarea
                id="declineReason"
                name="reason"
                rows={3}
                required
                maxLength={300}
                placeholder="例：同一时段已在另一位长辈家中，无法按时到达。"
                className="field"
              />
              <p className="text-xs text-ink-400">
                提交后服务督导会收到通知并重新安排，不会直接取消这次服务。
              </p>
              <BigButton tone="danger" icon={<X className="h-5 w-5" />}>
                提交并请督导重新安排
              </BigButton>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              className="w-full py-2 text-[13px] text-ink-500 underline underline-offset-2"
            >
              这次无法前往
            </button>
          )}
        </>
      ) : null}

      {/* 已接受 → 到达签到 */}
      {status === 'ACCEPTED' || status === 'READY_TO_DEPART' ? (
        <form action={checkIn} className="space-y-2">
          <input type="hidden" name="taskId" value={taskId} />
          {coords ? (
            <>
              <input type="hidden" name="lat" value={coords.lat} />
              <input type="hidden" name="lng" value={coords.lng} />
              {coords.accuracy ? (
                <input type="hidden" name="accuracy" value={coords.accuracy} />
              ) : null}
            </>
          ) : null}

          <div className="card px-4 py-3.5">
            <p className="text-[13px] leading-relaxed text-ink-600">
              到达长辈家门口后再签到。定位只在这一刻记录一次，公司不会持续追踪您的位置。
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="flex items-center gap-1.5 rounded-lg border border-cream-400 px-3 py-2 text-[13px] text-ink-700 active:bg-cream-100"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {coords ? '已取到位置' : '记录当前位置（可选）'}
              </button>
              {coords ? <span className="text-xs text-brand-600">✓</span> : null}
            </div>
            {locError ? <p className="mt-2 text-xs text-ink-400">{locError}</p> : null}
          </div>

          <BigButton icon={<MapPin className="h-5 w-5" />}>我已到达</BigButton>
        </form>
      ) : null}

      {/* 已到达 → 开始服务 */}
      {status === 'ARRIVED' ? (
        <form action={start}>
          <input type="hidden" name="taskId" value={taskId} />
          <BigButton icon={<Play className="h-5 w-5" />}>开始服务</BigButton>
        </form>
      ) : null}

      {/* 服务中 / 待记录 → 提示填记录 */}
      {(status === 'IN_SERVICE' || status === 'PENDING_RECORD') && !hasRecord ? (
        <div className="rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-700">服务进行中</p>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-700">
            服务结束后，在下方填写服务记录并提交，这次任务就完成了。
          </p>
        </div>
      ) : null}

      {/* 无法完成服务 */}
      {['ACCEPTED', 'READY_TO_DEPART', 'ARRIVED', 'IN_SERVICE'].includes(status) ? (
        showNotDone ? (
          <form action={notDone} className="card space-y-2 px-4 py-4">
            <input type="hidden" name="taskId" value={taskId} />
            <label className="label" htmlFor="notDoneReason">
              未能完成服务的原因
            </label>
            <textarea
              id="notDoneReason"
              name="reason"
              rows={3}
              required
              maxLength={300}
              placeholder="例：按门铃与电话均无人应答，在门口等待 20 分钟。"
              className="field"
            />
            <p className="text-xs text-ink-400">
              这仍会形成一条记录，不会静默消失。若是联系不上长辈，请同时使用「需要协助」上报。
            </p>
            <BigButton tone="warm">提交「服务未完成」</BigButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotDone(true)}
            className="w-full py-2 text-[13px] text-ink-500 underline underline-offset-2"
          >
            本次未能完成服务
          </button>
        )
      ) : null}

      {status === 'PENDING_REVIEW' ? (
        <div className="rounded-card border border-cream-300 bg-cream-50 px-4 py-3">
          <p className="text-sm font-medium text-ink-700">记录已提交，等待服务督导审核</p>
          <p className="mt-1 text-[13px] text-ink-500">您在这个家庭今天的工作已经完成。</p>
        </div>
      ) : null}

      {status === 'COMPLETED' ? (
        <div className="rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-700">这次服务已完成并通过审核</p>
        </div>
      ) : null}
    </div>
  );
}
