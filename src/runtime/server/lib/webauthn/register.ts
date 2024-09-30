import { eventHandler, H3Error, createError, getRequestURL, readBody } from 'h3'
import type { GenerateRegistrationOptionsOpts } from '@simplewebauthn/server'
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'
import defu from 'defu'
import type { RegistrationResponseJSON } from '@simplewebauthn/types'
import { bufferToBase64URLString } from '@simplewebauthn/browser'
import { getRandomValues } from 'uncrypto'
import { storeChallengeAsSession, getChallengeFromSession } from './utils'
import { useRuntimeConfig } from '#imports'
import type { WebAuthnUser, WebAuthnRegisterEventHandlerOptions } from '#auth-utils'

type RegistrationBody = {
  user: WebAuthnUser
  verify: false
} | {
  user: WebAuthnUser
  verify: true
  attemptId: string
  response: RegistrationResponseJSON
}

export function defineWebAuthnRegisterEventHandler({
  storeChallenge,
  getChallenge,
  getOptions,
  validateUser,
  onSuccess,
  onError,
}: WebAuthnRegisterEventHandlerOptions) {
  return eventHandler(async (event) => {
    const url = getRequestURL(event)
    const body = await readBody<RegistrationBody>(event)
    if (body.verify === undefined || !body.user?.userName)
      throw createError({
        message: 'Invalid request, missing userName or verify property',
        statusCode: 400,
      })

    if (validateUser) {
      await validateUser(body.user).catch((error) => {
        throw createError({
          status: 400,
          statusMessage: 'User Validation Error',
          message: 'User Validation Error',
          data: error,
        })
      })
    }

    const _config = defu(await getOptions?.(event) ?? {}, useRuntimeConfig(event).webauthn.register, {
      rpID: url.hostname,
      rpName: url.hostname,
      userName: body.user.userName,
      userDisplayName: body.user.displayName,
      authenticatorSelection: {
        userVerification: 'preferred',
      },
    } satisfies GenerateRegistrationOptionsOpts)

    try {
      if (!body.verify) {
        const options = await generateRegistrationOptions(_config as GenerateRegistrationOptionsOpts)
        const attemptId = bufferToBase64URLString(getRandomValues(new Uint8Array(32)))

        // If the developer has stricter storage requirements, they can implement their own storeChallenge function to store the options in a database or KV store
        if (storeChallenge)
          await storeChallenge?.(event, options.challenge, attemptId)
        else
          await storeChallengeAsSession(event, options.challenge, attemptId)

        return {
          creationOptions: options,
          attemptId,
        }
      }

      if (!body.attemptId) {
        throw createError({
          message: 'Invalid request, missing attemptId',
          statusCode: 400,
        })
      }

      let expectedChallenge: string
      if (getChallenge)
        expectedChallenge = await getChallenge(event, body.attemptId)
      else
        expectedChallenge = await getChallengeFromSession(event, body.attemptId)

      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: url.origin,
        expectedRPID: url.hostname,
        requireUserVerification: false, // TODO: make configurable https://simplewebauthn.dev/docs/advanced/passkeys#verifyregistrationresponse
        supportedAlgorithmIDs: _config.supportedAlgorithmIDs,
      })

      if (!verification.verified) {
        throw createError({
          message: 'Failed to verify registration response',
          statusCode: 400,
        })
      }

      await onSuccess(event, {
        user: body.user,
        credential: {
          id: verification.registrationInfo!.credentialID,
          publicKey: bufferToBase64URLString(verification.registrationInfo!.credentialPublicKey),
          counter: verification.registrationInfo!.counter,
          backedUp: verification.registrationInfo!.credentialBackedUp,
          transports: body.response.response.transports,
        },
        registrationInfo: verification.registrationInfo!,
      })
      return verification
    }
    catch (error) {
      if (!onError) throw error
      if (error instanceof H3Error)
        return onError(event, error)
      return onError(event, createError({ statusCode: 500, message: 'Failed to register credential' }))
    }
  })
}
