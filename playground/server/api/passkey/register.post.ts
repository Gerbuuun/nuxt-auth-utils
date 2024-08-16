import { encodeBase64 } from '@oslojs/encoding'

export default passkeyRegisterEventHandler({
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
  onSuccess: async (event, { credentialId, encodedPublicKey, uniqueName, displayName }) => {
    // create user and store public key with credentialId related to the user
    const userEntry = {
      publicKey: encodeBase64(encodedPublicKey),
      credentialId: encodeBase64(credentialId),
      uniqueName,
      displayName,
    }

    await useStorage().setItem(`publicKey:${credentialId}`, userEntry)
    await setUserSession(event, {
      user: {
        passkey: encodeBase64(credentialId),
        uniqueName,
        displayName: displayName || '',
      },
      loggedInAt: Date.now(),
    })
  },
})
