import { Profile, type ChangePasswordInput, type UpdateProfileInput } from '@/contracts'
import { api, requestVoid } from '@/lib/api'

export const profileApi = {
  get: (signal?: AbortSignal) => api.get(Profile, '/profile', { signal }),
  update: (input: UpdateProfileInput) => api.patch(Profile, '/profile', input),
  /** 204. A senha só passa por aqui: nunca por mutation, cache ou storage. */
  changePassword: (input: ChangePasswordInput) =>
    requestVoid({ method: 'PATCH', url: '/profile/password', data: input }),
  /** Multipart, campo `file`. */
  uploadAvatar: (blob: Blob) => {
    const body = new FormData()
    body.append('file', blob, 'avatar.webp')
    return api.put(Profile, '/profile/avatar', body)
  },
  removeAvatar: () => api.delete(Profile, '/profile/avatar'),
}
