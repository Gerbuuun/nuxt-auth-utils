import { eventHandler, readBody, H3Error, getCookie, setCookie } from 'h3'
import { ClientDataType, createAssertionSignatureMessage, parseAuthenticatorData } from '@oslojs/webauthn'
import { decodeBase64 } from '@oslojs/encoding'
import { decodePKIXECDSASignature, decodeSEC1PublicKey, p256, verifyECDSASignature } from '@oslojs/crypto/ecdsa'
import { sha256 } from '@oslojs/crypto/sha2'
import { generateChallenge, generateLoginOptions, validateAuthenticatorData, validateClientData } from '../../utils/passkey'
import type { PasskeyLoginEventHandler } from '#auth-utils'
import { createError } from '#imports'

export function passkeyLoginEventHandler({
  storeChallenge,
  getChallenge,
  getCredential,
  onSuccess,
  onError,
}: PasskeyLoginEventHandler) {
  return eventHandler(async (event) => {
    try {
      const body = await readBody(event)
      const attemptId = getCookie(event, 'attemptId')

      if (!attemptId) {
        const data = generateLoginOptions(event)
        const attemptId = generateChallenge()
        setCookie(event, 'attemptId', attemptId, { maxAge: 60_000, httpOnly: true, secure: true })
        await storeChallenge(event, body.credentialId, attemptId)
        return data
      }
      setCookie(event, 'attemptId', '', { maxAge: 0, httpOnly: true, secure: true })

      const credentialId = decodeBase64(body.credentialId)
      const signature = decodeBase64(body.signature)
      const encodedAuthenticatorData = decodeBase64(body.authenticatorData)
      const clientDataJSON = decodeBase64(body.clientDataJSON)

      const authenticatorData = parseAuthenticatorData(encodedAuthenticatorData)
      validateAuthenticatorData(event, authenticatorData)

      const expectedChallenge = await getChallenge(event, body.challengeId)

      validateClientData(event, ClientDataType.Get, decodeBase64(expectedChallenge), clientDataJSON)

      // Get publicKey and user ID from credential ID
      const { user, encodedPublicKey } = await getCredential(event, credentialId)

      // Decode DER-encoded signature
      const ecdsaSignature = decodePKIXECDSASignature(signature)
      const ecdsaPublicKey = decodeSEC1PublicKey(p256, encodedPublicKey)
      const hash = sha256(createAssertionSignatureMessage(encodedAuthenticatorData, clientDataJSON))
      const valid = verifyECDSASignature(ecdsaPublicKey, hash, ecdsaSignature)
      if (valid) {
        return onSuccess(event, user)
      }
      else {
        const invalid = createError({ statusCode: 401, message: 'Invalid signature' })
        if (!onError) throw invalid
        return onError(event, invalid)
      }
    }
    catch (error) {
      if (!onError) throw error
      if (error instanceof H3Error) {
        return onError(event, error)
      }
      return onError(event, createError({ statusCode: 401, message: 'Passkey login failed' }))
    }
  })
}
