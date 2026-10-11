import { Camera, ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import { S } from '../content/strings.ts'

/**
 * Two large, sunlight-readable actions. `capture="environment"` opens the rear camera on
 * phones; desktop browsers show a file picker. Works without a secure context or network.
 */
export default function PhotoCapture({ onFile, disabled }: { onFile: (file: File, source: 'camera' | 'upload') => void; disabled?: boolean }) {
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const take = (source: 'camera' | 'upload') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file, source)
    e.target.value = ''
  }
  return (
    <div className="capture">
      <button type="button" className="btn btn--primary btn--xl btn--block" disabled={disabled} onClick={() => camera.current?.click()}>
        <Camera size={22} aria-hidden /> {S.explore.takePhoto}
      </button>
      <button type="button" className="btn btn--xl btn--block" disabled={disabled} onClick={() => library.current?.click()}>
        <ImagePlus size={20} aria-hidden /> {S.explore.choosePhoto}
      </button>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" hidden onChange={take('camera')} />
      <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={take('upload')} />
    </div>
  )
}
