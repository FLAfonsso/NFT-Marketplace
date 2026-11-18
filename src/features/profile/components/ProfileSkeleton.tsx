import { Bone } from '@/features/cart'
import { PROFILE_GRID } from './ProfileForm'

const Field = ({ label = 'w-32' }: { label?: string }) => (
  <div className="flex flex-col gap-1.5">
    <Bone className={`h-5 ${label}`} />
    <Bone className="h-10 w-full rounded-sm" />
  </div>
)

/** Mesmas dimensões do formulário: grade, campos (rótulo 20 + campo 40), avatar e senha. */
export function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div className={PROFILE_GRID}>
        <Field />
        <Field label="w-36" />
        <Field label="w-20" />
        <Field label="w-24" />
        <Field label="w-40" />
        <div className="flex flex-col gap-1.5">
          <Bone className="h-5 w-16" />
          <div className="flex h-[50px] items-center gap-6">
            <Bone className="size-[50px] rounded-full" />
            <Bone className="h-10 w-28 rounded-sm" />
            <Bone className="h-5 w-16" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:w-[calc(50%-0.875rem)]">
        <Bone className="mb-6 h-6 w-32" />
        <Field label="w-28" />
        <Field label="w-24" />
        <Field label="w-40" />
      </div>
      <Bone className="h-10 w-full rounded-sm lg:w-32" />
    </div>
  )
}
