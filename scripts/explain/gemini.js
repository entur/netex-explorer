/**
 * Gemini-klient (Vertex AI) som oppfyller `Client`-grensesnittet fra run.js.
 * Innlogging skjer via Application Default Credentials; ingen nøkler i repoet.
 * SDK-et lastes først når klienten lages, så kjøringer uten kall trenger verken SDK eller innlogging.
 */
export async function createGeminiClient({ project, location, model, temperature = 0.2 }) {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ vertexai: true, project, location })

  return {
    async generate({ system, user, schema }) {
      let response
      try {
        response = await ai.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature,
          },
        })
      } catch (err) {
        // SDK-feil (ApiError) har numerisk `status`; andre feil sendes videre uendret
        if (typeof err?.status === 'number') {
          const wrapped = new Error(err.message)
          wrapped.status = err.status
          throw wrapped
        }
        throw err
      }
      if (!response.text) throw new Error('Tomt svar fra Gemini')
      return JSON.parse(response.text)
    },
  }
}
