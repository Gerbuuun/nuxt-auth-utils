import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { decodeBase64, encodeBase64 } from '@oslojs/encoding'
import { createError } from '#imports'
import type {
  SerializedPublicKeyCredentialCreationOptions,
  SerializedPublicKeyCredentialRequestOptions,
  PasskeyComposable,
} from '#auth-utils'

export function usePasskey(): PasskeyComposable {
  async function isSupported() {
    if (
      window.PublicKeyCredential
      && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      && PublicKeyCredential.isConditionalMediationAvailable
    ) {
      return Promise.all([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        PublicKeyCredential.isConditionalMediationAvailable(),
      ]).then(v => v.every(Boolean))
    }
    return false
  }

  async function register(
    endpoint: MaybeRefOrGetter<string>,
    uniqueName: MaybeRefOrGetter<string>,
    displayName?: MaybeRefOrGetter<string>,
  ) {
    const registerConfig = await $fetch<SerializedPublicKeyCredentialCreationOptions>(toValue(endpoint), {
      method: 'POST',
      body: {
        name: toValue(uniqueName),
        displayName: toValue(displayName),
      },
    })

    const credential = await navigator.credentials.create({
      publicKey: {
        ...registerConfig,
        challenge: decodeBase64(registerConfig.challenge),
        user: {
          id: decodeBase64(registerConfig.user.id),
          name: registerConfig.user.name,
          displayName: registerConfig.user.displayName,
        },
      },
    })

    if (!(credential instanceof PublicKeyCredential))
      throw createError({ message: 'Failed to create public key' })
    if (!(credential.response instanceof AuthenticatorAttestationResponse))
      throw createError({ message: 'Failed to create attestation response' })

    await $fetch(toValue(endpoint), {
      method: 'POST',
      body: {
        attestationObject: encodeBase64(new Uint8Array(credential.response.attestationObject)),
        clientDataJSON: encodeBase64(new Uint8Array(credential.response.clientDataJSON)),
      },
    })
  }

  async function login(endpoint: MaybeRefOrGetter<string>) {
    const loginConfig = await $fetch<SerializedPublicKeyCredentialRequestOptions>(toValue(endpoint), { method: 'POST' })

    const credential = await navigator.credentials.get({
      publicKey: {
        ...loginConfig,
        challenge: decodeBase64(loginConfig.challenge),
      },
    })

    if (!(credential instanceof PublicKeyCredential))
      throw createError({ message: 'Failed to create public key' })
    if (!(credential.response instanceof AuthenticatorAssertionResponse))
      throw createError({ message: 'Failed to create assertion response' })

    await $fetch(toValue(endpoint), {
      method: 'POST',
      body: {
        credentialId: encodeBase64(new Uint8Array(credential.rawId)),
        signature: encodeBase64(new Uint8Array(credential.response.signature)),
        clientDataJSON: encodeBase64(new Uint8Array(credential.response.clientDataJSON)),
        authenticatorData: encodeBase64(new Uint8Array(credential.response.authenticatorData)),
      },
    })
  }

  return {
    isSupported,
    register,
    login,
  }
}
