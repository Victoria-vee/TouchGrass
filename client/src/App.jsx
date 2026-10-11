import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAsterisk, faArrowLeft, faArrowRight, faBookOpen, faCircleCheck, faPen, faStar, faTrashCan } from '@fortawesome/free-solid-svg-icons'
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
    <div className="meadow" aria-hidden="true">
      <div className="meadow-sun" />
      <div className="meadow-cloud meadow-cloud-one" />
      <div className="meadow-cloud meadow-cloud-two" />
      <div className="meadow-hill meadow-hill-back" />
      <div className="meadow-hill meadow-hill-middle" />
      <div className="meadow-hill meadow-hill-front" />
      <span className="meadow-flower flower-one" aria-hidden="true">✿</span>
      <span className="meadow-flower flower-two" aria-hidden="true">✿</span>
      <span className="meadow-flower flower-three" aria-hidden="true">✿</span>
      {/* <span className="meadow-caption">there's room to breathe</span> */}
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

function formatCompletionDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
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
  const [completionLoading, setCompletionLoading] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [savedCompletion, setSavedCompletion] = useState(null)
  const [journalEntries, setJournalEntries] = useState([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalError, setJournalError] = useState('')
  const [deletingCompletionId, setDeletingCompletionId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [journalReturnScreen, setJournalReturnScreen] = useState('home')
  const cameraInput = useRef(null)
  const photoInput = useRef(null)
  const notePhotoPreviewUrl = useRef('')
  const notePhotoBase64Cache = useRef(null)
  const requestInProgress = useRef(false)
  const feedbackInProgress = useRef(false)
  const clarificationInProgress = useRef(false)
  const completionInProgress = useRef(false)
  const journalInProgress = useRef(false)
  const deletionInProgress = useRef(false)
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
    setAiFeedback(null)
    setClarification('')
    setClarifications([])
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

      setChallenge({ ...data, completionId: crypto.randomUUID() })
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'We could not reach the challenge service. Check that the backend is running, then try again.'
        : requestError instanceof Error && requestError.message
          ? requestError.message
          : "We couldn't find a challenge just now. Please try again in a moment.")
    } finally {
      requestInProgress.current = false
      setLoading(false)
    }
  }

  async function loadJournal() {
    if (journalInProgress.current) return
    journalInProgress.current = true
    setJournalLoading(true)
    setJournalError('')
    try {
      const response = await fetch('http://localhost:3000/api/completions')
      let data
      try {
        data = await response.json()
      } catch {
        throw new Error('The journal returned an unexpected response. Please try again.')
      }
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Your journal could not be loaded. Please try again.')
      }
      if (!Array.isArray(data?.completions)) {
        throw new Error('The journal returned an unexpected response. Please try again.')
      }
      setJournalEntries(data.completions)
    } catch (loadError) {
      setJournalError(loadError instanceof TypeError
        ? 'We could not reach your journal. Check that the backend is running, then retry.'
        : loadError instanceof Error && loadError.message
          ? loadError.message
          : 'Your journal could not be loaded. Please try again.')
    } finally {
      journalInProgress.current = false
      setJournalLoading(false)
    }
  }

  async function openJournal() {
    if (screen !== 'journal') setJournalReturnScreen(screen)
    setScreen('journal')
    await loadJournal()
  }

  async function deleteJournalEntry(entry) {
    if (deletionInProgress.current) return
    if (!window.confirm(`Delete “${entry.questTitle || 'this outdoor moment'}” from your journal?`)) return

    deletionInProgress.current = true
    setDeletingCompletionId(entry.completionId)
    setDeleteError('')
    try {
      const response = await fetch(`http://localhost:3000/api/completions/${encodeURIComponent(entry.completionId)}`, { method: 'DELETE' })
      let data
      try {
        data = await response.json()
      } catch {
        throw new Error('The journal returned an unexpected response. Refresh and try again.')
      }
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'This journal entry could not be deleted. Please try again.')
      setJournalEntries((entries) => entries.filter((item) => item.completionId !== entry.completionId))
    } catch (error) {
      setDeleteError(error instanceof TypeError
        ? 'We could not reach your journal. Check that the backend is running, then try again.'
        : error instanceof Error && error.message ? error.message : 'This journal entry could not be deleted. Please try again.')
    } finally {
      deletionInProgress.current = false
      setDeletingCompletionId('')
    }
  }

  function closeJournal() {
    setScreen(journalReturnScreen)
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
    setCompletionError('')
    setSavedCompletion(null)
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
    setCompletionError('')
    setAiFeedback(null)
    setClarification('')
    setClarifications([])
  }

  function removeNotePhoto() {
    clearNotePhoto()
    setNotePhotoError('')
    if (cameraInput.current) cameraInput.current.value = ''
    if (photoInput.current) photoInput.current.value = ''
  }

  async function sendReflectionRequest(clarificationText = '') {
    const requestBody = { reflection: reflection.trim() }
    if (challenge) requestBody.challenge = { title: challenge.title, activity: challenge.activity }
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

    const validStatuses = ['readable', 'partially_readable', 'unclear', 'no_image', 'not_applicable']
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

  async function saveQuestCompletion(feedback = aiFeedback, clarificationHistory = clarifications) {
    if (completionInProgress.current) return false
    if (!notePhoto) {
      setCompletionError('Add a photo of your notes or drawing before completing this quest.')
      return false
    }
    if (!challenge?.completionId) {
      setCompletionError('This quest could not be saved. Please start a new challenge and try again.')
      return false
    }

    completionInProgress.current = true
    setCompletionLoading(true)
    setCompletionError('')

    try {
      const requestBody = new FormData()
      requestBody.set('completionId', challenge.completionId)
      requestBody.set('questPrompt', challenge.activity)
      requestBody.set('questTitle', challenge.title)
      requestBody.set('durationMinutes', String(challenge.durationMinutes))
      requestBody.set('typedSummary', reflection.trim())
      requestBody.set('aiFeedback', feedback ? JSON.stringify(feedback) : '')
      requestBody.set('clarificationHistory', JSON.stringify(clarificationHistory))
      requestBody.set('photo', notePhoto, notePhoto.name || 'handwritten-notes')

      const response = await fetch('http://localhost:3000/api/completions', {
        method: 'POST',
        body: requestBody,
      })
      let data
      try {
        data = await response.json()
      } catch {
        throw new Error('The save service returned an unexpected response. Your quest and notes are still here; please retry.')
      }
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Your quest could not be saved. Your notes are still here; please retry.')
      }
      if (
        data?.completionId !== challenge.completionId ||
        !Number.isFinite(data?.totalXp) ||
        data?.xpAwarded !== 5 ||
        typeof data?.alreadyCompleted !== 'boolean'
      ) {
        throw new Error('The save service returned incomplete quest details. Your notes are still here; please retry.')
      }

      setSavedCompletion(data)
      setCompletionError('')
      setScreen('complete')
      return true
    } catch (error) {
      setCompletionError(error instanceof TypeError
        ? 'We could not reach the save service. Your quest, photo, and notes are still here; please retry.'
        : error instanceof Error && error.message
          ? error.message
          : 'Your quest could not be saved. Your notes are still here; please retry.')
      return false
    } finally {
      completionInProgress.current = false
      setCompletionLoading(false)
    }
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
      setClarifications([])
      setClarification('')
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
      const nextClarifications = [...clarifications, currentClarification]
      setAiFeedback(data)
      setClarifications(nextClarifications)
      if (screen === 'complete') await saveQuestCompletion(data, nextClarifications)
      setClarification('')
      setClarificationError('')
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

  async function confirmInterpretation() {
    if (!aiFeedback || feedbackInProgress.current) return
    await saveQuestCompletion(aiFeedback, clarifications)
  }

  const handwritingStatus = aiFeedback?.handwriting?.status
  const hasHandwritingResult = ['readable', 'partially_readable', 'unclear'].includes(handwritingStatus)
  const handwritingNeedsClarification = ['partially_readable', 'unclear'].includes(handwritingStatus)
  const isDrawing = handwritingStatus === 'not_applicable'

  return (
    <main className="page-shell" id="home">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="out'n'about home">
          <LeafMark />
          <span>out'n'about<span className="brand-dot">.</span></span>
        </a>
        <button className="journal-nav-button" type="button" onClick={screen === 'journal' ? closeJournal : openJournal}>
          <FontAwesomeIcon className="nav-icon" icon={screen === 'journal' ? faArrowLeft : faBookOpen} aria-hidden="true" />
          {screen === 'journal' ? 'Back to your moment' : 'My journal'}
        </button>
      </header>

      {screen === 'home' && (
        <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true">
          <MeadowIllustration />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">A MOMENT FOR YOURSELF</p>
          <h1 id="hero-title" tabIndex={-1}>A little less scrolling.<br /><em>A little more living.</em></h1>
          <p className="intro">
            Get a gentle idea for spending a little time outdoors. Then put your phone away, take it at your own pace, and enjoy being where you are.
          </p>
          <button className="challenge-button" type="button" onClick={getChallenge} disabled={loading}>
            <span>{loading ? 'Finding a little moment...' : error ? 'Try again' : 'Get a challenge'}</span>
            <span className="button-arrow" aria-hidden="true">{loading ? <span className="loading-spinner" /> : <FontAwesomeIcon icon={faArrowRight} />}</span>
          </button>
          <p className="gentle-note"><span aria-hidden="true"><FontAwesomeIcon icon={faAsterisk} /></span> No rush. No streaks. Just a little fresh air.</p>
        </div>
        <div className="challenge-card" aria-live="polite" aria-atomic="true" aria-busy={loading}>
          <div className="challenge-copy">
            <p className="card-label">
              {loading ? 'A MOMENT PLEASE' : error ? 'A SMALL PAUSE' : challenge ? `YOUR LITTLE OUTDOOR CHALLENGE · ${challenge.durationMinutes} MINUTES` : 'A GENTLE REMINDER'}
            </p>
            <h2 className={error && !loading ? 'challenge-error' : undefined} role={error && !loading ? 'alert' : undefined}>
              {loading ? (
                  <span className="loading-message" role="status" aria-label="Finding a little idea for you">
                    <span aria-hidden="true">
                      Finding a little idea for you<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
                    </span>
                  </span>
                ) : error ? (
                  error
                ) : challenge ? (
                  challenge.activity
                ) : (
                  'When you are ready, we will find a small moment outside for you.'
                )}
            </h2>
            {challenge && !loading && <p className="paper-note">Before you begin, bring paper and a pen. You’ll use them outside to jot down anything you notice or want to remember.</p>}
            {challenge && !loading && !error && (
              <button className="start-session-button" type="button" onClick={() => setScreen('prepare')}>
                Start challenge <FontAwesomeIcon className="inline-action-icon" icon={faArrowRight} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      <footer className="footer">
        <span>Copyright © 2026. All rights reserved.</span>
      </footer>
        {/* <svg className="grass-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 21C170 14 215 64 360 64C520 64 560 18 720 18C880 18 920 64 1080 64C1225 64 1270 18 1440 22V90H0Z" fill="#dfe3ce" />
          <path d="M0 48C170 40 210 76 360 76C520 76 560 37 720 38C880 37 920 76 1080 76C1230 76 1270 42 1440 48V90H0Z" fill="#b8c49c" />
          <path d="M132 47c5-12 8-16 13-22m-7 22c-1-11-3-16-7-21m348 18c4-10 8-14 13-19m-7 19c0-10-2-14-6-18m326 21c4-12 7-16 12-21m-6 21c0-11-2-16-6-20m387 0c4-11 8-15 13-20m-7 20c0-10-2-14-6-18m191 7c4-10 8-14 13-18m-7 18c0-9-2-13-6-17" fill="none" stroke="#708767" strokeLinecap="round" strokeWidth="2" />
        </svg> */}
      </section>


        </>
      )}

      {screen === 'journal' && (
        <section className="journey-screen journal-screen" id="journey" aria-labelledby="journey-title" aria-busy={journalLoading}>
          <p className="eyebrow">YOUR OUTDOOR MOMENTS</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>Your journal.</h1>
          <p className="journey-intro">A quiet place to revisit the moments you saved after stepping outside.</p>
          <div className="journal-overview" aria-label="Journal summary">
            <div className="journal-summary-item"><span className="journal-summary-icon" aria-hidden="true"><LeafMark/></span><span><strong>{journalEntries.reduce((total, entry) => total + (Number.isFinite(entry.xpAwarded) ? entry.xpAwarded : 5), 0)}</strong><small>Total XP earned</small></span></div>
            <div className="journal-summary-item"><span className="journal-summary-icon journal-summary-flower" aria-hidden="true"><FontAwesomeIcon icon={faCircleCheck} /></span><span><strong>{journalEntries.length}</strong><small>Quests completed</small></span></div>
          </div>
          <div className="journal-toolbar">
            <p>{journalLoading ? 'Gathering your saved moments...' : `${journalEntries.length} ${journalEntries.length === 1 ? 'moment' : 'moments'} saved`}</p>
            <button className="journal-refresh-button" type="button" onClick={loadJournal} disabled={journalLoading}>
              {journalLoading ? 'Loading...' : 'Refresh journal'}
            </button>
          </div>
          {deleteError && <p className="journal-delete-error" role="alert">{deleteError}</p>}
          {journalLoading && <p className="journal-status" role="status">Loading your journal...</p>}
          {journalError && (
            <div className="journal-message" role="alert">
              <p>{journalError}</p>
              <button className="journal-refresh-button" type="button" onClick={loadJournal} disabled={journalLoading}>Try again</button>
            </div>
          )}
          {!journalLoading && !journalError && journalEntries.length === 0 && (
            <div className="journal-message journal-empty">
              <h2>No saved moments yet.</h2>
              <p>When you finish a quest with a photo of your notes or drawing, it will find a place here.</p>
            </div>
          )}
          {!journalError && journalEntries.length > 0 && (
            <div className="journal-list">
              {journalEntries.map((entry, index) => {
                const photoUrl = typeof entry.photoPath === 'string' && entry.photoPath.startsWith('uploads/')
                  ? `http://localhost:3000/${entry.photoPath}`
                  : ''
                const dateTime = new Date(entry.completedAt)
                const entryId = `journal-entry-${index}`
                return (
                  <article className="journal-entry" key={entry.completionId || entryId} aria-labelledby={entryId}>
                    <header className="journal-entry-header">
                      <div>
                        <p className="card-label">YOUR OUTDOOR MOMENT</p>
                        <h2 id={entryId}>{entry.questTitle || 'A moment outside'}</h2>
                      </div>
                      <div className="journal-entry-meta">
                        <time dateTime={Number.isNaN(dateTime.getTime()) ? undefined : dateTime.toISOString()}>{formatCompletionDate(entry.completedAt)}</time>
                        <span className="journal-entry-xp"><FontAwesomeIcon icon={faStar} aria-hidden="true" /> {Number.isFinite(entry.xpAwarded) ? entry.xpAwarded : 5} XP earned</span>
                        <button className="journal-delete-button" type="button" onClick={() => deleteJournalEntry(entry)} disabled={Boolean(deletingCompletionId)} aria-label={`Delete ${entry.questTitle || 'journal entry'}`} title="Delete journal entry">
                          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                        </button>
                      </div>
                    </header>
                    <p className="journal-prompt">{entry.questPrompt}</p>
                    {photoUrl && (
                      <figure className="journal-photo">
                        <img src={photoUrl} alt={`Handwritten notes for ${entry.questTitle || 'this outdoor moment'}`} loading="lazy" />
                        <figcaption>Your handwritten notes</figcaption>
                      </figure>
                    )}
                    {entry.typedSummary && (
                      <section className="journal-detail">
                        <h3>Your summary</h3>
                        <p className="journal-preserve-lines">{entry.typedSummary}</p>
                      </section>
                    )}
                    {entry.aiFeedback?.feedback && (
                      <section className="journal-detail journal-ai-feedback">
                        <h3>A little reflection</h3>
                        <p>{entry.aiFeedback.feedback}</p>
                        {entry.aiFeedback.interpretation && (
                          <div className="journal-interpretation">
                            <h4>Interpretation</h4>
                            <p className="journal-preserve-lines">{entry.aiFeedback.interpretation}</p>
                          </div>
                        )}
                        {entry.aiFeedback.handwriting?.transcription && (
                          <div className="journal-interpretation">
                            <h4>What could be read</h4>
                            <p className="journal-preserve-lines">{entry.aiFeedback.handwriting.transcription}</p>
                          </div>
                        )}
                      </section>
                    )}
                    {Array.isArray(entry.clarificationHistory) && entry.clarificationHistory.length > 0 && (
                      <section className="journal-detail">
                        <h3>Your clarifications</h3>
                        {entry.clarificationHistory.map((item, clarificationIndex) => (
                          <p className="journal-preserve-lines" key={`${entry.completionId}-${clarificationIndex}`}>{item}</p>
                        ))}
                      </section>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
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
            <span>I’ve got my paper and pen</span><span className="button-arrow" aria-hidden="true"><FontAwesomeIcon icon={faArrowRight} /></span>
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
            <span className="guidance-mark" aria-hidden="true"><FontAwesomeIcon icon={faPen} /></span>
            <div>
              <h2>Now, let your phone rest.</h2>
              <p>Put your phone away, take a slow breath, and enjoy the moment. Use your paper and pen to write down anything you notice or want to remember. There is no timer, GPS, or check-in; come back whenever you feel ready.</p>
            </div>
          </div>
          <button className="challenge-button journey-button" type="button" onClick={() => setScreen('reflection')}>
            <span>I'm back</span><span className="button-arrow" aria-hidden="true"><FontAwesomeIcon icon={faArrowRight} /></span>
          </button>
        </section>
      )}

      {screen === 'reflection' && challenge && (
        <section className="journey-screen reflection-screen" id="journey" aria-labelledby="journey-title">
          <p className="eyebrow">A MOMENT TO NOTICE</p>
          <h1 className="journey-title" id="journey-title" tabIndex={-1}>Look back at your notes.</h1>
          <p className="journey-intro">Take a moment to review what you wrote or drew. If you like, share a short summary of what you noticed and your experience here.</p>
          <section className="note-photo-section" aria-labelledby="note-photo-title">
            <h2 id="note-photo-title">Add a photo of your notes or drawing (optional)</h2>
            <p>Choose a JPEG, PNG, or WebP image up to 8 MB. A photo is required to save your completed quest. If you request feedback, the photo is also sent to your configured Ollama server (local by default).</p>
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
                aria-label="Take a photo of your notes or drawing"
                tabIndex={-1}
                disabled={feedbackLoading}
                onChange={handleNotePhotoSelection}
              />
              <input
                ref={photoInput}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose a photo of your notes or drawing"
                tabIndex={-1}
                disabled={feedbackLoading}
                onChange={handleNotePhotoSelection}
              />
            </div>
            {notePhotoError && <p className="note-photo-error" role="alert">{notePhotoError}</p>}
            {notePhotoPreview && (
              <figure className="note-photo-preview">
                <img src={notePhotoPreview} alt="Preview of your notes or drawing" />
                <figcaption>
                  <span>Photo ready on this device</span>
                  <button className="remove-photo-button" type="button" onClick={removeNotePhoto} disabled={feedbackLoading}>Remove photo</button>
                </figcaption>
              </figure>
            )}
          </section>
          <label className="reflection-label" htmlFor="reflection-note">A few words about what I noticed</label>
          <textarea
            id="reflection-note"
            className="reflection-textarea"
            value={reflection}
            onChange={(event) => {
              setReflection(event.target.value)
              if (aiFeedback) {
                setAiFeedback(null)
                setClarifications([])
                setClarification('')
              }
            }}
            placeholder="A detail from your notes or drawing, or something you’d like to remember..."
            maxLength={MAX_TYPED_REFLECTION_LENGTH}
            disabled={feedbackLoading}
            rows={6}
          />
          {aiFeedback && (
            <section className="ai-feedback-card interpretation-review" aria-labelledby="interpretation-review-title" aria-busy={feedbackLoading}>
              <p className="card-label">PLEASE REVIEW BEFORE SAVING</p>
              <h2 id="interpretation-review-title">Does this reflect your drawing and writing?</h2>
              <p className="ai-feedback-message">{aiFeedback.feedback}</p>
              <div className="handwriting-reading">
                <h3>Current interpretation</h3>
                <blockquote>{aiFeedback.interpretation}</blockquote>
                {aiFeedback.handwriting.transcription && (
                  <>
                    <h3>Handwriting the model could read</h3>
                    <blockquote>{aiFeedback.handwriting.transcription}</blockquote>
                  </>
                )}
                {aiFeedback.handwriting.status === 'partially_readable' && <p className="interpretation-note">Some handwriting may be missing. You can correct the written words or the visual interpretation below.</p>}
                {aiFeedback.handwriting.status === 'unclear' && <p className="interpretation-note">The handwriting was difficult to read. You can correct the written words or the visual interpretation below.</p>}
              </div>
              <label className="reflection-label" htmlFor="review-clarification">Correct the interpretation (optional)</label>
              <textarea
                id="review-clarification"
                className="reflection-textarea clarification-textarea"
                value={clarification}
                onChange={(event) => {
                  setClarification(event.target.value)
                  if (clarificationError) setClarificationError('')
                }}
                placeholder="For example: the drawing shows a leaf, and the note says it was growing beside the path."
                maxLength={MAX_CLARIFICATION_LENGTH}
                disabled={feedbackLoading || clarifications.length >= MAX_CLARIFICATION_ATTEMPTS}
                rows={3}
              />
              {clarificationError && <p className="feedback-error" role="alert">{clarificationError}</p>}
              {clarifications.length < MAX_CLARIFICATION_ATTEMPTS && (
                <button className="finish-without-feedback" type="button" onClick={submitClarification} disabled={feedbackLoading || !clarification.trim()}>
                  {feedbackLoading ? 'Updating interpretation...' : 'Update interpretation'}
                </button>
              )}
              <button className="challenge-button journey-button" type="button" onClick={confirmInterpretation} disabled={feedbackLoading || completionLoading}>
                <span>{completionLoading ? 'Saving your quest...' : 'This looks right — save'}</span>
                <span className="button-arrow" aria-hidden="true">{completionLoading ? <span className="loading-spinner" /> : <FontAwesomeIcon icon={faArrowRight} />}</span>
              </button>
              {clarifications.length > 0 && <p className="clarification-attempts">You can make {MAX_CLARIFICATION_ATTEMPTS - clarifications.length} more interpretation {MAX_CLARIFICATION_ATTEMPTS - clarifications.length === 1 ? 'update' : 'updates'} before saving.</p>}
            </section>
          )}
          {feedbackError && <p className="feedback-error" role="alert">{feedbackError}</p>}
          {completionError && <p className="feedback-error" role="alert">{completionError}</p>}
          <div className="feedback-actions">
            {!aiFeedback && (
              <button className="challenge-button journey-button" type="button" onClick={requestReflectionFeedback} disabled={feedbackLoading || completionLoading}>
                <span>{feedbackLoading ? 'Reading your notes...' : 'Get a gentle response'}</span>
                <span className="button-arrow" aria-hidden="true">{feedbackLoading || completionLoading ? <span className="loading-spinner" /> : <FontAwesomeIcon icon={faArrowRight} />}</span>
              </button>
            )}
            {!aiFeedback && <button className="finish-without-feedback" type="button" onClick={() => saveQuestCompletion()} disabled={feedbackLoading || completionLoading}>
              {completionLoading ? 'Saving your quest...' : 'Finish without AI feedback'}
            </button>}
          </div>
          {(feedbackLoading || completionLoading) && <p className="feedback-loading-note" role="status">{feedbackLoading ? 'Your image and summary are being sent to your configured Ollama model for a brief response.' : 'Saving your completed quest and image.'}</p>}
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
          {savedCompletion && (
            <p className="completion-xp" role="status">
              {savedCompletion.alreadyCompleted
                ? `Quest saved. ${savedCompletion.xpAwarded} XP is already counted; your total is ${savedCompletion.totalXp} XP.`
                : `${savedCompletion.xpAwarded} XP awarded. Your total is ${savedCompletion.totalXp} XP.`}
            </p>
          )}
          {completionError && (
            <div>
              <p className="feedback-error" role="alert">{completionError}</p>
              <button className="finish-without-feedback" type="button" onClick={() => saveQuestCompletion(aiFeedback, clarifications)} disabled={completionLoading || feedbackLoading}>
                {completionLoading ? 'Saving your quest...' : 'Retry saving completion'}
              </button>
            </div>
          )}
          {notePhotoPreview && (
            <figure className="completion-photo">
              <img src={notePhotoPreview} alt="Your selected photo of your notes or drawing" />
              <figcaption>Your notes or drawing photo</figcaption>
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
                <p className="interpretation-note">
                  {aiFeedback.handwriting.status === 'readable'
                    ? 'This interpretation draws on the words the model could read in your photo; compare it with your notes if a detail feels uncertain.'
                    : aiFeedback.handwriting.status === 'partially_readable'
                      ? 'Some handwriting was unclear, so the interpretation may miss a detail. You can clarify any words below.'
                      : aiFeedback.handwriting.status === 'not_applicable'
                        ? 'This interpretation is based on the visible image and your original challenge context.'
                      : aiFeedback.handwriting.status === 'no_image'
                        ? 'This interpretation is based on your typed summary and challenge context, since no image was provided.'
                        : 'The handwriting was difficult to read, so treat this interpretation as tentative. You can clarify any words below.'}
                </p>
              </div>
              {hasHandwritingResult && (
              <div className="handwriting-reading">
                <h3>Handwriting in the photo</h3>
                {aiFeedback.handwriting.status === 'readable' && aiFeedback.handwriting.transcription
                  ? <blockquote>{aiFeedback.handwriting.transcription}</blockquote>
                  : aiFeedback.handwriting.status === 'partially_readable'
                    ? <p>Some handwriting was unclear. {aiFeedback.handwriting.transcription ? `The model could make out: ${aiFeedback.handwriting.transcription}` : 'The model could not confidently transcribe any words.'}</p>
                    : aiFeedback.handwriting.status === 'unclear'
                      ? <p>The model could not confidently read the handwriting.</p>
                      : aiFeedback.handwriting.status === 'no_image'
                        ? <p>No image was provided. This response is based only on your typed summary.</p>
                        : <p>The model could not confidently read the handwriting.</p>}
              </div>
              )}
              {clarifications.length > 0 && (
                <div className="clarification-history">
                  <p className="card-label">YOUR CLARIFICATION{clarifications.length > 1 ? 'S' : ''}</p>
                  {clarifications.map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}
                </div>
              )}
            </section>
          )}
          {notePhoto && aiFeedback && (handwritingNeedsClarification || isDrawing || feedbackNeedsClarification(aiFeedback.feedback)) && (
            <section className="clarification-panel" aria-labelledby="clarification-title" aria-busy={feedbackLoading}>
              <h2 id="clarification-title">{handwritingNeedsClarification ? 'Help with the handwriting' : 'Help with the interpretation'}</h2>
              <p>{handwritingNeedsClarification
                ? 'If a word was unclear, type it here or correct the reading. Your correction will guide another response; the original photo and summary stay with it.'
                : 'Add context or correct a detail in the image interpretation. Your clarification will guide another response; the original photo and notes stay with it.'}</p>
              {clarifications.length < MAX_CLARIFICATION_ATTEMPTS ? (
                <>
                  <label className="reflection-label" htmlFor="handwriting-clarification">{handwritingNeedsClarification ? 'Type unclear words or correct the interpretation' : 'Clarify the image interpretation'}</label>
                  <textarea
                    id="handwriting-clarification"
                    className="reflection-textarea clarification-textarea"
                    value={clarification}
                    onChange={(event) => {
                      setClarification(event.target.value)
                      if (clarificationError) setClarificationError('')
                    }}
                    placeholder={handwritingNeedsClarification ? 'For example: the word is ‘sparrows’, not ‘shadows’...' : 'For example: this drawing shows a leaf, not a bird...'}
                    maxLength={MAX_CLARIFICATION_LENGTH}
                    disabled={feedbackLoading}
                    rows={3}
                  />
                  {clarificationError && <p className="feedback-error" role="alert">{clarificationError}</p>}
                  <button className="challenge-button journey-button clarification-submit" type="button" onClick={submitClarification} disabled={feedbackLoading}>
                    <span>{feedbackLoading ? 'Sending clarification...' : 'Submit clarification'}</span>
                    <span className="button-arrow" aria-hidden="true">{feedbackLoading ? <span className="loading-spinner" /> : <FontAwesomeIcon icon={faArrowRight} />}</span>
                  </button>
                  <p className="clarification-attempts">{MAX_CLARIFICATION_ATTEMPTS - clarifications.length} clarification {MAX_CLARIFICATION_ATTEMPTS - clarifications.length === 1 ? 'attempt' : 'attempts'} available. You can finish whenever you like.</p>
                </>
              ) : (
                <p className="clarification-limit">That is enough to work with. You can finish with the interpretation above and keep your original handwritten notes.</p>
              )}
            </section>
          )}
          <button className="challenge-button journey-button" type="button" onClick={startNewChallenge} disabled={feedbackLoading}>
            <span>Start a new challenge</span><span className="button-arrow" aria-hidden="true"><FontAwesomeIcon icon={faArrowRight} /></span>
          </button>
        </section>
      )}
    </main>
  )
}

export default App
