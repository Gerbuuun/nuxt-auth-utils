import { bufferToBase64URLString } from '@simplewebauthn/browser'
import { getRandomValues } from 'uncrypto'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types'
import definePasskeyRegistrationEventHandler from '../../../../src/runtime/server/lib/webauthn/register' // FIXME: autoimport

export default definePasskeyRegistrationEventHandler({
  storeChallenge: async (event, options) => {
    const attemptId = bufferToBase64URLString(getRandomValues(new Uint8Array(32)))
    await useStorage('db').setItem(`passkeys:${attemptId}`, options)
    setCookie(event, 'passkey-attempt-id', attemptId)
  },
  getChallenge: async (event) => {
    const attemptId = getCookie(event, 'passkey-attempt-id')
    if (!attemptId)
      throw createError({ statusCode: 400 })

    const options = await useStorage<PublicKeyCredentialCreationOptionsJSON>('db').getItem(`passkeys:${attemptId}`)
    if (!options)
      throw createError({ statusCode: 400 })

    await useStorage<PublicKeyCredentialCreationOptionsJSON>('db').removeItem(`passkeys:${attemptId}`)
    return options
  },
  onSuccces: async (event, response, body) => {
    const user = {
      id: 1,
      displayName: body.displayName,
      userName: body.userName,
      publicKey: bufferToBase64URLString(response!.credentialPublicKey),
      counter: response!.counter,
    }
    await useStorage('db').setItem(`users:${response!.credentialID}`, user)
    await setUserSession(event, {
      user: {
        passkey: response!.credentialID,
      },
      loggedInAt: Date.now(),
    })
  },
  onError: (_, error) => {
    console.log('Error', error)
  },
  config: async (event) => {
    const body = await readBody(event)
    return {
      rpID: getRequestURL(event).hostname,
      rpName: 'My Passkey',
      userName: body.userName,
      userDisplayName: body.displayName,
    }
  },
})
