import { type H3Event, H3Error } from 'h3'
import { eventHandler, readBody, createError, getCookie, setCookie } from 'h3'
import { decodeBase64 } from '@oslojs/encoding'
import { ECDSAPublicKey, p256 } from '@oslojs/crypto/ecdsa'
import { ClientDataType } from '@oslojs/webauthn'
import { generateChallenge, generateRegistrationOptions, validateAttestationObject, validateClientData } from '../../utils/passkey'
import type { PasskeyRegisterEventHandler } from '#auth-utils'

export function passkeyRegisterEventHandler({
  storeChallenge,
  getChallenge,
  onSuccess,
  onError,
}: PasskeyRegisterEventHandler) {
  return eventHandler(async (event: H3Event) => {
    try {
      const body = await readBody(event)
      const challengeId = getCookie(event, 'challengeId')

      if (!challengeId) {
        if (!body.uniqueName) {
          throw createError({ statusCode: 401, message: 'Missing name' })
        }
        const data = generateRegistrationOptions(event, body.uniqueName, body.displayName || '')
        const challengeId = generateChallenge()
        setCookie(event, 'challengeId', challengeId, { maxAge: 60_000, httpOnly: true, secure: true })
        await storeChallenge(event, data.challenge, challengeId)
        return data
      }
      setCookie(event, 'challengeId', '', { maxAge: 0, httpOnly: true, secure: true })

      const encodedAttestationObject = decodeBase64(body.attestationObject)
      const { cosePublicKey, authenticatorData } = validateAttestationObject(event, encodedAttestationObject)

      const expectedChallenge = await getChallenge(event, challengeId)

      const clientDataJSON = decodeBase64(body.clientDataJSON)
      validateClientData(event, ClientDataType.Create, decodeBase64(expectedChallenge), clientDataJSON)

      await onSuccess(event, {
        credentialId: authenticatorData.credential.id,
        encodedPublicKey: new ECDSAPublicKey(p256, cosePublicKey.x, cosePublicKey.y).encodeSEC1Uncompressed(),
        uniqueName: body.uniqueName,
        displayName: body.displayName,
      })
    }
    catch (error) {
      if (!onError) throw error
      if (error instanceof H3Error) {
        return onError(event, error)
      }
      return onError(event, createError({ statusCode: 401, message: 'Passkey registration failed' }))
    }
  })
}
