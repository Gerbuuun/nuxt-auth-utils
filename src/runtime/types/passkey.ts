import type { H3Event, H3Error } from 'h3'
import type { MaybeRefOrGetter } from 'vue'
import type { User } from './session'

interface PasskeyEventHandler<T> {
  /**
   * Store the challenge to be retrieved later
   * @param event H3Event
   * @param challenge Base64 encoded challenge
   */
  storeChallenge: (
    event: H3Event,
    challenge: string,
    attemptId: string
  ) => Promise<void> | void

  /**
   * Get the challenge to be used for the login
   * @param event H3Event
   * @param challengeId Challenge ID
   * @returns Base64 encoded challenge
   */
  getChallenge: (
    event: H3Event,
    challengeId: string
  ) => Promise<string> | string

  onSuccess: (event: H3Event, result: T) => Promise<void> | void
  onError?: (event: H3Event, error: H3Error) => Promise<void> | void
}

export interface PasskeyLoginEventHandler extends PasskeyEventHandler<User> {
  getCredential: (event: H3Event, credentialId: Uint8Array) =>
    Promise<{ user: User, encodedPublicKey: Uint8Array }> | { user: User, encodedPublicKey: Uint8Array }
}

export type PasskeyRegisterEventHandler = PasskeyEventHandler<{
  credentialId: Uint8Array
  encodedPublicKey: Uint8Array
  uniqueName: string
  displayName?: string
}>

export interface PasskeyChallengeEventHandler {
  onRegister: (
    event: H3Event,
    data: {
      uniqueName: string
      displayName: string
      challenge: string
    }
  ) => Promise<string> | string
  onLogin: (
    event: H3Event,
    data: {
      credentialId: string
      challenge: string
    }
  ) => Promise<string> | string
}

// In future browser versions, JSON serialized Credentials will be available
// For now, we need to serialize (and type) them manually
type SerializedOptions<T> = {
  [K in keyof T]: T[K] extends BufferSource
    ? string
    : T[K] extends Array<infer U>
      ? Array<SerializedOptions<U>>
      : T[K] extends object
        ? SerializedOptions<T[K]>
        : T[K]
}
export type SerializedPublicKeyCredentialCreationOptions = SerializedOptions<PublicKeyCredentialCreationOptions>
export type SerializedPublicKeyCredentialRequestOptions = SerializedOptions<PublicKeyCredentialRequestOptions>

export interface PasskeyComposable {
  /**
   * Check if the browser supports passkeys
   */
  isSupported: () => Promise<boolean>

  /**
   * Create a new passkey
   * @param endpoint The endpoint to where the passkey register event handler is defined
   * @param uniqueName The unique name of the user (e.g. email, username)
   * @param displayName The display name of the user which will be stored with the passkey on the user's device
   */
  register: (endpoint: MaybeRefOrGetter<string>, uniqueName: MaybeRefOrGetter<string>, displayName?: MaybeRefOrGetter<string>) => Promise<void>

  /**
   * Get a passkey
   * @param endpoint The endpoint to where the passkey login event handler is defined
   */
  login: (endpoint: MaybeRefOrGetter<string>) => Promise<void>
}
