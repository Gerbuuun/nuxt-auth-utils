import { decodeBase64, encodeBase64 } from '@oslojs/encoding'

export default passkeyLoginEventHandler({
  getChallenge: async (event, challengeId) => {
    // get challenge from persistant storage and return as base64 encoded string
    const challenge = await useStorage<string>().getItem(`challenge:${challengeId}`)

    if (!challenge)
      throw createError({ statusCode: 401, message: 'Challenge not found' })

    await useStorage().removeItem(`challenge:${challengeId}`)
    return challenge
  },
  storeChallenge: async (event, challenge, challengeId) => {
    // store challenge in persistant storage
    await useStorage().setItem(`challenge:${challengeId}`, challenge)
  },
  getCredential: async (event, credentialId) => {
    // get public key from persistant storage and return as base64 encoded string
    const publicKey = await useStorage<string>().getItem(`publicKey:${credentialId}`)

    if (!publicKey)
      throw createError({ statusCode: 401, message: 'Public key not found' })

    await useStorage().removeItem(`publicKey:${credentialId}`)
    return {
      user: {
        passkey: encodeBase64(credentialId),
        uniqueName: 'John Doe',
        displayName: 'John Doe',
      },
      encodedPublicKey: decodeBase64(publicKey),
    }
  },
  onSuccess: async (event, user) => {
    await setUserSession(event, {
      user,
      loggedInAt: Date.now(),
    })
  },
})
