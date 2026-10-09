import { useEffect, useRef, useState } from 'react'
import './App.css'

const MAX_NOTE_PHOTO_SIZE = 8 * 1024 * 1024
const MAX_TYPED_REFLECTION_LENGTH = 2000
const MAX_CLARIFICATION_LENGTH = 2000
const MAX_CLARIFICATION_ATTEMPTS = 2
const ALLOWED_NOTE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function feedbackNeedsClarification(feedback) {
  return /unclear|cannot confidently read|could not confidently read|can't read|couldn't read|hard to read|clarif|correct (?:it|the reading)|missing (?:word|words)|(?:could|would) you (?:please )?(?:clarify|confirm|correct|type|tell me)|(?:what|which) (?:word|words|part)/i.test(feedback)
}

function LeafMark() {
  return (
    <svg className="leaf-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M33 7C20 8 10 13 9 22c-.6 5.5 3.5 9.5 8.7 9C27 30 32 21 33 7Z" fill="currentColor" />
      <path d="M8 34c5-8 10-13 19-20" stroke="#f6f5ed" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MeadowIllustration() {
  return (
    <div className="meadow" role="img" aria-label="Rolling sage-green hills beneath a warm afternoon sun">
      <div className="meadow-sun" />
      <div className="meadow-cloud meadow-cloud-one" />
      <div className="meadow-cloud meadow-cloud-two" />
      <div className="meadow-hill meadow-hill-back" />
      <div className="meadow-hill meadow-hill-middle" />
      <div className="meadow-hill meadow-hill-front" />
      <span className="meadow-flower flower-one" aria-hidden="true">✿</span>
      <span className="meadow-flower flower-two" aria-hidden="true">✿</span>
      <span className="meadow-flower flower-three" aria-hidden="true">✿</span>
      <span className="meadow-caption">there's room to breathe</span>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The selected photo could not be read. Please choose it again.'))
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const separator = dataUrl.indexOf(',')
      if (separator < 0) {
        reject(new Error('The selected photo could not be read. Please choose it again.'))
        return
      }
      resolve(dataUrl.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

function App() {
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState('home')
  const [reflection, setReflection] = useState('')
  const [notePhoto, setNotePhoto] = useState(null)
  const [notePhotoPreview, setNotePhotoPreview] = useState('')
  const [notePhotoError, setNotePhotoError] = useState('')
  const [aiFeedback, setAiFeedback] = useState(null)
  const [clarification, setClarification] = useState('')
  const [clarifications, setClarifications] = useState([])
  const [clarificationError, setClarificationError] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const cameraInput = useRef(null)
  const photoInput = useRef(null)
  const notePhotoPreviewUrl = useRef('')
  const notePhotoBase64Cache = useRef(null)
  const requestInProgress = useRef(false)
  const feedbackInProgress = useRef(false)
  const clarificationInProgress = useRef(false)
  const hasChangedScreen = useRef(false)

  useEffect(() => {
    if (!hasChangedScreen.current) {
      hasChangedScreen.current = true
      return
    }

    const headingId = screen === 'home' ? 'hero-title' : 'journey-title'
    document.getElementById(headingId)?.focus()
  }, [screen])

  useEffect(() => {
    return () => {
      if (notePhotoPreviewUrl.current) URL.revokeObjectURL(notePhotoPreviewUrl.current)
    }
  }, [])

  function clearNotePhoto() {
    if (notePhotoPreviewUrl.current) URL.revokeObjectURL(notePhotoPreviewUrl.current)
    notePhotoPreviewUrl.current = ''
    notePhotoBase64Cache.current = null
    setNotePhoto(null)
    setNotePhotoPreview('')
  }

  async function getChallenge() {
    if (requestInProgress.current) return

    requestInProgress.current = true
    setLoading(true)
    setError('')
    setChallenge(null)

    try {
      const response = await fetch('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'The challenge service is unavailable.')
      }

      if (
        typeof data?.title !== 'string' ||
        !data.title.trim() ||
        typeof data?.activity !== 'string' ||
        !data.activity.trim() ||
        !Number.isInteger(data?.durationMinutes) ||
        data.durationMinutes < 10 ||
        data.durationMinutes > 20
      ) {
        throw new Error('The challenge response was incomplete.')
      }

      setChallenge(data)
    } catch {
      setError("We couldn't find a challenge just now. Please try again in a moment.")
    } finally {
      requestInProgress.current = false
      setLoading(false)
    }
  }

  function startNewChallenge() {
    setScreen('home')
    setReflection('')
    clearNotePhoto()
    setNotePhotoError('')
    setAiFeedback(null)
    setClarification('')
    setClarifications([])
    setClarificationError('')
    setFeedbackError('')
    getChallenge()
  }

  function handleNotePhotoSelection(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    if (!ALLOWED_NOTE_PHOTO_TYPES.includes(file.type.toLowerCase())) {
      setNotePhotoError('Please choose a JPEG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_NOTE_PHOTO_SIZE) {
      setNotePhotoError('That image is larger than 8 MB. Please choose a smaller photo.')
      return
    }

    if (notePhotoPreviewUrl.current) URL.revokeObjectURL(notePhotoPreviewUrl.current)
    const previewUrl = URL.createObjectURL(file)
    notePhotoPreviewUrl.current = previewUrl
    notePhotoBase64Cache.current = null
    setNotePhoto(file)
    setNotePhotoPreview(previewUrl)
    setNotePhotoError('')
  }

  function removeNotePhoto() {
    clearNotePhoto()
    setNotePhotoError('')
    if (cameraInput.current) cameraInput.current.value = ''
    if (photoInput.current) photoInput.current.value = ''
  }

  async function sendReflectionRequest(clarificationText = '') {
    const requestBody = { reflection: reflection.trim() }
    if (notePhoto) {
      if (notePhotoBase64Cache.current?.file !== notePhoto) {
        notePhotoBase64Cache.current = { file: notePhoto, base64: await fileToBase64(notePhoto) }
      }
      requestBody.imageBase64 = notePhotoBase64Cache.current.base64
      requestBody.imageMimeType = notePhoto.type
    }
    if (clarificationText) requestBody.clarification = clarificationText

    const response = await fetch('http://localhost:3000/api/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    let data
    try {
      data = await response.json()
    } catch {
      throw new Error('The feedback service returned an unexpected response. Your notes are still here; please try again.')
    }

    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'We could not get feedback just now. Your notes are still here; please try again.')
    }

    const validStatuses = ['readable', 'partially_readable', 'unclear', 'no_image']
    if (
      typeof data?.feedback !== 'string' ||
      !data.feedback.trim() ||
      typeof data?.interpretation !== 'string' ||
      !data.interpretation.trim() ||
      !validStatuses.includes(data?.handwriting?.status) ||
      typeof data?.handwriting?.transcription !== 'string'
    ) {
      throw new Error('The feedback service returned an unexpected response. Your notes are still here; please try again.')
    }

    return data
  }

  async function requestReflectionFeedback() {
    if (feedbackInProgress.current) return
    if (!notePhoto && !reflection.trim()) {
      setFeedbackError('Add a photo of your notes or type a short summary to get a response.')
      return
    }

    feedbackInProgress.current = true
    setFeedbackLoading(true)
    setFeedbackError('')

    try {
      const data = await sendReflectionRequest()
      setAiFeedback(data)
      setScreen('complete')
    } catch (error) {
      setFeedbackError(error instanceof TypeError
        ? 'We could not reach the feedback service. Your photo and summary are still here; please try again.'
        : error instanceof Error && error.message
          ? error.message
          : 'We could not get feedback just now. Your notes are still here; please try again.')
    } finally {
      feedbackInProgress.current = false
      setFeedbackLoading(false)
    }
  }

  async function submitClarification() {
    if (feedbackInProgress.current || clarificationInProgress.current) return
    const currentClarification = clarification.trim()
    if (!currentClarification) {
      setClarificationError('Type the unclear words or your correction before submitting.')
      return
    }
    if (clarifications.length >= MAX_CLARIFICATION_ATTEMPTS) return

    clarificationInProgress.current = true
    feedbackInProgress.current = true
    setFeedbackLoading(true)
    setClarificationError('')

    try {
      const allClarifications = [...clarifications, currentClarification].join('\n')
      const data = await sendReflectionRequest(allClarifications)
      setAiFeedback(data)
      setClarifications((previous) => [...previous, currentClarification])
      setClarification('')
    } catch (error) {
      setClarificationError(error instanceof TypeError
        ? 'We could not reach the feedback service. Your photo and notes are still here; please try again.'
        : error instanceof Error && error.message
          ? error.message
          : 'We could not send your clarification just now. Your photo and notes are still here; please try again.')
    } finally {
      clarificationInProgress.current = false
      feedbackInProgress.current = false
      setFeedbackLoading(false)
    }
  }

  return (
    <main className="page-shell" id="home">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Touch Grass home">
          <LeafMark />
          <span>Touch Grass<span className="brand-dot">.</span></span>
        </a>
        <p className="topbar-note"><span aria-hidden="true">✳</span> A small invitation outside</p>
      </header>

      {screen === 'home' && (
        <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">A MOMENT FOR YOURSELF</p>
          <h1 id="hero-title" tabIndex={-1}>A little less scrolling.<br /><em>A little more living.</em></h1>
          <p className="intro">
            Get a gentle idea for spending a little time outdoors. Then put your phone away, take it at your own pace, and enjoy being where you are.
          </p>
          <button className="challenge-button" type="button" onClick={getChallenge} disabled={loading}>
            <span>{loading ? 'Finding a little moment...' : error ? 'Try again' : 'Get a challenge'}</span>
            <span className="button-arrow" aria-hidden="true">{loading ? <span className="loading-spinner" /> : '↗'}</span>
          </button>
          <p className="gentle-note"><span aria-hidden="true">✳</span> No rush. No streaks. Just a little fresh air.</p>
        </div>
        <MeadowIllustration />
      </section>

      <section className="challenge-card" aria-live="polite" aria-atomic="true" aria-busy={loading}>
        <div className={`challenge-icon${loading ? ' is-loading' : ''}`} aria-hidden="true">
          {loading ? <span className="loading-spinner" /> : challenge ? '↗' : '✳'}
        </div>
        <div className="challenge-copy">
          <p className="card-label">
            {loading ? 'A MOMENT PLEASE' : error ? 'A SMALL PAUSE' : challenge ? `YOUR LITTLE OUTDOOR CHALLENGE · ${challenge.durationMinutes} MINUTES` : 'A GENTLE REMINDER'}
          </p>
          <h2>
            {loading ? 'Finding a little moment outdoors...' : error ? 'Your next little adventure is still out there.' : challenge ? challenge.title : 'The best part starts when you put your phone down.'}
          </h2>
          <p className={error && !loading ? 'challenge-error' : undefined} role={error && !loading ? 'alert' : undefined}>
            {loading ? 'Asking your local guide for one gentle idea.' : error ? error : challenge ? challenge.activity : 'When you are ready, we will find a small moment outside for you.'}
          </p>
          {challenge && !loading && <p className="paper-note">Before you begin, bring paper and a pen. You’ll use them outside to jot down anything you notice or want to remember.</p>}
          {challenge && !loading && !error && (
            <button className="start-session-button" type="button" onClick={() => setScreen('prepare')}>
              Start challenge <span aria-hidden="true">&rarr;</span>
            </button>
          )}
        </div>
        <LeafMark />
      </section>
        </>
      )}

      {screen === 'prepare' && challenge && (
        <section className="journey-screen preparation-screen" id="journey" aria-labelledby="journey-title">
          <p className="eyebrow">BEFORE YOU HEAD OUT</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>Take paper and a pen.</h1>
          <article className="journey-challenge">
            <p className="card-label">YOUR CHALLENGE - {challenge.durationMinutes} MINUTES</p>
            <h2>{challenge.title}</h2>
            <p>{challenge.activity}</p>
          </article>
          <p className="journey-intro preparation-note">Bring paper and a pen with you. While you’re outside, use them to record anything you notice or want to remember.</p>
          <button className="challenge-button journey-button" type="button" onClick={() => setScreen('active')}>
            <span>I’ve got my paper and pen</span><span className="button-arrow" aria-hidden="true">&rarr;</span>
          </button>
        </section>
      )}

      {screen === 'active' && challenge && (
        <section className="journey-screen" id="journey" aria-labelledby="journey-title">
          <p className="eyebrow">YOUR TIME OUTSIDE</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>A little space to unwind.</h1>
          <article className="journey-challenge">
            <p className="card-label">YOUR CHALLENGE - {challenge.durationMinutes} MINUTES</p>
            <h2>{challenge.title}</h2>
            <p>{challenge.activity}</p>
          </article>
          <div className="session-guidance">
            <span className="guidance-mark" aria-hidden="true">*</span>
            <div>
              <h2>Now, let your phone rest.</h2>
              <p>Put your phone away, take a slow breath, and enjoy the moment. Use your paper and pen to write down anything you notice or want to remember. There is no timer, GPS, or check-in; come back whenever you feel ready.</p>
            </div>
          </div>
          <button className="challenge-button journey-button" type="button" onClick={() => setScreen('reflection')}>
            <span>I'm back</span><span className="button-arrow" aria-hidden="true">&rarr;</span>
          </button>
        </section>
      )}

      {screen === 'reflection' && challenge && (
        <section className="journey-screen reflection-screen" id="journey" aria-labelledby="journey-title">
          <p className="eyebrow">A MOMENT TO NOTICE</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>Look back at your notes.</h1>
          <p className="journey-intro">Take a moment to review what you wrote by hand. If you like, share a short summary of those notes and your experience here.</p>
          <section className="note-photo-section" aria-labelledby="note-photo-title">
            <h2 id="note-photo-title">Add a photo of your paper notes (optional)</h2>
            <p>Choose a JPEG, PNG, or WebP image up to 8 MB. If you request feedback, it is sent to your configured Ollama server (local by default) and is not stored by Touch Grass.</p>
            <div className="note-photo-actions">
              <button className="photo-action-button" type="button" onClick={() => cameraInput.current?.click()} disabled={feedbackLoading}>
                Take a photo
              </button>
              <button className="photo-action-button" type="button" onClick={() => photoInput.current?.click()} disabled={feedbackLoading}>
                Choose an existing photo
              </button>
              <input
                ref={cameraInput}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                aria-label="Take a photo of your handwritten notes"
                tabIndex={-1}
                disabled={feedbackLoading}
                onChange={handleNotePhotoSelection}
              />
              <input
                ref={photoInput}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose a photo of your handwritten notes"
                tabIndex={-1}
                disabled={feedbackLoading}
                onChange={handleNotePhotoSelection}
              />
            </div>
            {notePhotoError && <p className="note-photo-error" role="alert">{notePhotoError}</p>}
            {notePhotoPreview && (
              <figure className="note-photo-preview">
                <img src={notePhotoPreview} alt="Preview of your handwritten paper notes" />
                <figcaption>
                  <span>Photo ready on this device</span>
                  <button className="remove-photo-button" type="button" onClick={removeNotePhoto} disabled={feedbackLoading}>Remove photo</button>
                </figcaption>
              </figure>
            )}
          </section>
          <label className="reflection-label" htmlFor="reflection-note">A summary of my handwritten notes</label>
          <textarea
            id="reflection-note"
            className="reflection-textarea"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="A few words from your paper notes, or something you’d like to remember..."
            maxLength={MAX_TYPED_REFLECTION_LENGTH}
            disabled={feedbackLoading}
            rows={6}
          />
          {feedbackError && <p className="feedback-error" role="alert">{feedbackError}</p>}
          <div className="feedback-actions">
            <button className="challenge-button journey-button" type="button" onClick={requestReflectionFeedback} disabled={feedbackLoading}>
              <span>{feedbackLoading ? 'Reading your notes...' : 'Get a gentle response'}</span>
              <span className="button-arrow" aria-hidden="true">{feedbackLoading ? <span className="loading-spinner" /> : '\u2192'}</span>
            </button>
            <button className="finish-without-feedback" type="button" onClick={() => setScreen('complete')} disabled={feedbackLoading}>
              Finish without AI feedback
            </button>
          </div>
          {feedbackLoading && <p className="feedback-loading-note" role="status">Your photo and summary are being sent to your configured Ollama model for a brief response.</p>}
        </section>
      )}

      {screen === 'complete' && challenge && (
        <section className="journey-screen completion-screen" id="journey" aria-labelledby="journey-title">
          <p className="eyebrow">A LITTLE MORE LIVING</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>Thanks for stepping outside.</h1>
          <p className="journey-intro">You made a little room for the world around you. That is enough.</p>
          <article className="completion-card">
            <p className="card-label">YOUR OUTDOOR MOMENT</p>
            <h2>{challenge.title}</h2>
            {reflection.trim()
              ? <div className="completion-reflection"><p className="card-label">YOUR TYPED SUMMARY</p><p>{reflection.trim()}</p></div>
              : <p className="completion-reflection">Your handwritten notes are yours to keep. No summary needed here; thanks for taking a moment outside.</p>}
          </article>
          {notePhotoPreview && (
            <figure className="completion-photo">
              <img src={notePhotoPreview} alt="Your selected photo of handwritten paper notes" />
              <figcaption>Your handwritten notes photo</figcaption>
            </figure>
          )}
          {aiFeedback && (
            <section className="ai-feedback-card" aria-labelledby="ai-feedback-title">
              <p className="card-label">A THOUGHT FROM YOUR LOCAL GUIDE</p>
              <h2 id="ai-feedback-title">A little reflection</h2>
              <p className="ai-feedback-message">{aiFeedback.feedback}</p>
              <div className="handwriting-reading">
                <h3>{clarifications.length ? 'Updated interpretation' : 'Current interpretation'}</h3>
                <blockquote>{aiFeedback.interpretation || 'The model could not form a reliable interpretation yet.'}</blockquote>
              </div>
              <div className="handwriting-reading">
                <h3>What the model could read in the photo</h3>
                {aiFeedback.handwriting.status === 'readable' && aiFeedback.handwriting.transcription
                  ? <blockquote>{aiFeedback.handwriting.transcription}</blockquote>
                  : aiFeedback.handwriting.status === 'partially_readable'
                    ? <p>Some handwriting was unclear. {aiFeedback.handwriting.transcription ? `The model could make out: ${aiFeedback.handwriting.transcription}` : 'The model could not confidently transcribe any words.'}</p>
                    : aiFeedback.handwriting.status === 'unclear'
                      ? <p>The model could not confidently read the handwriting.</p>
                      : aiFeedback.handwriting.status === 'no_image'
                        ? <p>No handwritten photo was provided. This response is based only on your typed summary.</p>
                        : <p>The model could not confidently read the handwriting.</p>}
              </div>
              {clarifications.length > 0 && (
                <div className="clarification-history">
                  <p className="card-label">YOUR CLARIFICATION{clarifications.length > 1 ? 'S' : ''}</p>
                  {clarifications.map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}
                </div>
              )}
            </section>
          )}
          {notePhoto && aiFeedback && (['partially_readable', 'unclear'].includes(aiFeedback.handwriting.status) || feedbackNeedsClarification(aiFeedback.feedback)) && (
            <section className="clarification-panel" aria-labelledby="clarification-title" aria-busy={feedbackLoading}>
              <h2 id="clarification-title">Help with the handwriting</h2>
              <p>If a word was unclear, type it here or correct the reading. Your correction will guide another response; the original photo and summary stay with it.</p>
              {clarifications.length < MAX_CLARIFICATION_ATTEMPTS ? (
                <>
                  <label className="reflection-label" htmlFor="handwriting-clarification">Type unclear words or correct the interpretation</label>
                  <textarea
                    id="handwriting-clarification"
                    className="reflection-textarea clarification-textarea"
                    value={clarification}
                    onChange={(event) => {
                      setClarification(event.target.value)
                      if (clarificationError) setClarificationError('')
                    }}
                    placeholder="For example: the word is ‘sparrows’, not ‘shadows’..."
                    maxLength={MAX_CLARIFICATION_LENGTH}
                    disabled={feedbackLoading}
                    rows={3}
                  />
                  {clarificationError && <p className="feedback-error" role="alert">{clarificationError}</p>}
                  <button className="challenge-button journey-button clarification-submit" type="button" onClick={submitClarification} disabled={feedbackLoading}>
                    <span>{feedbackLoading ? 'Sending clarification...' : 'Submit clarification'}</span>
                    <span className="button-arrow" aria-hidden="true">{feedbackLoading ? <span className="loading-spinner" /> : '\u2192'}</span>
                  </button>
                  <p className="clarification-attempts">{MAX_CLARIFICATION_ATTEMPTS - clarifications.length} clarification {MAX_CLARIFICATION_ATTEMPTS - clarifications.length === 1 ? 'attempt' : 'attempts'} available. You can finish whenever you like.</p>
                </>
              ) : (
                <p className="clarification-limit">That is enough to work with. You can finish with the interpretation above and keep your original handwritten notes.</p>
              )}
            </section>
          )}
          <button className="challenge-button journey-button" type="button" onClick={startNewChallenge} disabled={feedbackLoading}>
            <span>Start a new challenge</span><span className="button-arrow" aria-hidden="true">&rarr;</span>
          </button>
        </section>
      )}

      <footer className="footer">
        <span>Made for the moments between everything else.</span>
        <span className="footer-flower" aria-hidden="true">❧</span>
      </footer>
    </main>
  )
}

export default App
