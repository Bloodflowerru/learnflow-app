import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';
import { fileToDataURL } from './file-to-data-url';

/* ============ Врезка (Callout) ============ */
export const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      variant: { default: 'info' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const variant = block.props.variant as 'info' | 'success' | 'warning' | 'tip';
      return (
        <div className={`bn-callout bn-callout-${variant}`}>
          <div className="bn-callout-icon">{variantIcon(variant)}</div>
          <div className="bn-callout-body">
            <div ref={contentRef} className="bn-callout-content" />
            {editor.isEditable && (
              <div className="bn-callout-variants">
                {(['info', 'success', 'warning', 'tip'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`bn-callout-dot bn-callout-dot-${v} ${v === variant ? 'active' : ''}`}
                    onClick={() => editor.updateBlock(block, { props: { variant: v } })}
                    title={v}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    },
  }
);

/* ============ Аккордеон ============ */
export const AccordionBlock = createReactBlockSpec(
  {
    type: 'accordion',
    propSchema: {
      title: { default: 'Разверните, чтобы прочитать' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const [open, setOpen] = useState(editor.isEditable);
      return (
        <div className="bn-accordion">
          <div className="bn-accordion-head">
            {editor.isEditable ? (
              <input
                className="bn-accordion-title-input"
                value={block.props.title}
                onChange={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
                placeholder="Заголовок секции"
              />
            ) : (
              <span style={{ flex: 1 }}>{block.props.title || 'Разверните'}</span>
            )}
            {!editor.isEditable && (
              <button
                type="button"
                className="bn-accordion-toggle"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? '▾' : '▸'}
              </button>
            )}
          </div>
          <div
            className="bn-accordion-body"
            ref={contentRef}
            style={{ display: open ? 'block' : 'none' }}
          />
        </div>
      );
    },
  }
);

/* ============ Мини-тест (inline quiz) ============ */
export const InlineQuizBlock = createReactBlockSpec(
  {
    type: 'inlineQuiz',
    propSchema: {
      question: { default: 'Вопрос' },
      options: { default: JSON.stringify(['Вариант 1', 'Вариант 2', 'Вариант 3']) },
      correctIndex: { default: 0 },
      explanation: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const options = safeParseOptions(block.props.options as string);
      const [selected, setSelected] = useState<number | null>(null);
      const [checked, setChecked] = useState(false);

      if (editor.isEditable) {
        return (
          <div className="bn-quiz-edit">
            <input
              className="bn-quiz-edit-question"
              value={block.props.question}
              onChange={(e) => editor.updateBlock(block, { props: { question: e.target.value } })}
              placeholder="Текст вопроса"
            />
            <div className="bn-quiz-edit-options">
              {options.map((opt, i) => (
                <div key={i} className="bn-quiz-edit-row">
                  <input
                    type="radio"
                    name={`correct-${block.id}`}
                    checked={i === block.props.correctIndex}
                    onChange={() => editor.updateBlock(block, { props: { correctIndex: i } })}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      editor.updateBlock(block, { props: { options: JSON.stringify(next) } });
                    }}
                    placeholder={`Вариант ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="bn-quiz-edit-remove"
                    onClick={() => {
                      const next = options.filter((_, j) => j !== i);
                      const ci = block.props.correctIndex >= next.length ? 0 : block.props.correctIndex;
                      editor.updateBlock(block, {
                        props: { options: JSON.stringify(next), correctIndex: ci },
                      });
                    }}
                    disabled={options.length <= 2}
                  >×</button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="bn-quiz-edit-add"
              onClick={() => {
                const next = [...options, `Вариант ${options.length + 1}`];
                editor.updateBlock(block, { props: { options: JSON.stringify(next) } });
              }}
            >+ Вариант</button>
            <textarea
              className="bn-quiz-edit-explanation"
              value={block.props.explanation}
              onChange={(e) => editor.updateBlock(block, { props: { explanation: e.target.value } })}
              placeholder="Объяснение (показывается после проверки)"
              rows={2}
            />
            <div className="bn-quiz-edit-hint">
              Радио-кнопка слева — правильный ответ
            </div>
          </div>
        );
      }

      const isCorrect = checked && selected === block.props.correctIndex;
      return (
        <div className={`bn-quiz ${checked ? (isCorrect ? 'bn-quiz-correct' : 'bn-quiz-wrong') : ''}`}>
          <div className="bn-quiz-question">{block.props.question}</div>
          <div className="bn-quiz-options">
            {options.map((opt, i) => (
              <label
                key={i}
                className={`bn-quiz-option ${selected === i ? 'selected' : ''} ${
                  checked && i === block.props.correctIndex ? 'correct' : ''
                } ${checked && selected === i && i !== block.props.correctIndex ? 'wrong' : ''}`}
              >
                <input
                  type="radio"
                  name={`q-${block.id}`}
                  checked={selected === i}
                  onChange={() => { setSelected(i); setChecked(false); }}
                  disabled={checked}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {!checked ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setChecked(true)}
              disabled={selected === null}
            >Проверить</button>
          ) : (
            <div className="bn-quiz-feedback">
              <div className={`bn-quiz-feedback-head ${isCorrect ? 'ok' : 'no'}`}>
                {isCorrect ? '✓ Правильно' : '✗ Неправильно'}
              </div>
              {block.props.explanation && (
                <div className="bn-quiz-explanation">{block.props.explanation}</div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setSelected(null); setChecked(false); }}
              >Попробовать снова</button>
            </div>
          )}
        </div>
      );
    },
  }
);

/* ============ Изображение с загрузкой файла ============ */
export const ImageFileBlock = createReactBlockSpec(
  {
    type: 'imageFile',
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const url = block.props.url as string;

      const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          alert('Это не изображение');
          return;
        }
        try {
          const dataUrl = await fileToDataURL(file);
          editor.updateBlock(block, { props: { url: dataUrl } });
        } catch (err) {
          alert((err as Error).message);
        }
        e.target.value = '';
      };

      if (!editor.isEditable) {
        return (
          <figure className="bn-media">
            {url
              ? <img src={url} alt={block.props.caption || ''} />
              : <div className="bn-media-empty">Изображение не загружено</div>}
            {block.props.caption && <figcaption>{block.props.caption}</figcaption>}
          </figure>
        );
      }

      return (
        <div className="bn-media-edit">
          {url ? (
            <div className="bn-media-preview">
              <img src={url} alt="" />
            </div>
          ) : (
            <label className="bn-media-drop">
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
              <div className="bn-media-drop-icon">🖼</div>
              <div style={{ fontWeight: 600 }}>Нажмите, чтобы выбрать файл</div>
              <div className="bn-media-drop-hint">JPG, PNG, WebP, GIF — до 5 МБ</div>
            </label>
          )}

          <input
            type="text"
            className="bn-media-url"
            value={url}
            onChange={(e) => editor.updateBlock(block, { props: { url: e.target.value } })}
            placeholder="Или вставьте URL изображения"
          />

          <div className="bn-media-actions">
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
              {url ? 'Заменить файл' : 'Загрузить файл'}
            </label>
            {url && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => editor.updateBlock(block, { props: { url: '' } })}
              >Убрать</button>
            )}
          </div>

          <input
            type="text"
            className="bn-media-caption"
            value={block.props.caption}
            onChange={(e) => editor.updateBlock(block, { props: { caption: e.target.value } })}
            placeholder="Подпись (необязательно)"
          />
        </div>
      );
    },
  }
);

/* ============ Видео с загрузкой файла ============ */
export const VideoFileBlock = createReactBlockSpec(
  {
    type: 'videoFile',
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const url = block.props.url as string;

      const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('video/')) {
          alert('Это не видеофайл');
          return;
        }
        try {
          const dataUrl = await fileToDataURL(file);
          editor.updateBlock(block, { props: { url: dataUrl } });
        } catch (err) {
          alert((err as Error).message);
        }
        e.target.value = '';
      };

      const isDirect = url.startsWith('data:video') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

      if (!editor.isEditable) {
        return (
          <figure className="bn-media">
            {!url ? (
              <div className="bn-media-empty">Видео не загружено</div>
            ) : isDirect ? (
              <video src={url} controls className="bn-media-video" />
            ) : (
              <div className="bn-media-embed">
                <a href={url} target="_blank" rel="noreferrer">{url}</a>
              </div>
            )}
            {block.props.caption && <figcaption>{block.props.caption}</figcaption>}
          </figure>
        );
      }

      return (
        <div className="bn-media-edit">
          {url ? (
            <div className="bn-media-preview">
              {isDirect
                ? <video src={url} controls className="bn-media-video" />
                : <div className="bn-media-embed">{url}</div>}
            </div>
          ) : (
            <label className="bn-media-drop">
              <input type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} />
              <div className="bn-media-drop-icon">🎬</div>
              <div style={{ fontWeight: 600 }}>Нажмите, чтобы выбрать видео</div>
              <div className="bn-media-drop-hint">MP4, WebM, OGG — до 25 МБ</div>
            </label>
          )}

          <input
            type="text"
            className="bn-media-url"
            value={url}
            onChange={(e) => editor.updateBlock(block, { props: { url: e.target.value } })}
            placeholder="Или вставьте URL (YouTube, Vimeo, .mp4)"
          />

          <div className="bn-media-actions">
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <input type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} />
              {url ? 'Заменить файл' : 'Загрузить файл'}
            </label>
            {url && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => editor.updateBlock(block, { props: { url: '' } })}
              >Убрать</button>
            )}
          </div>

          <input
            type="text"
            className="bn-media-caption"
            value={block.props.caption}
            onChange={(e) => editor.updateBlock(block, { props: { caption: e.target.value } })}
            placeholder="Подпись (необязательно)"
          />
        </div>
      );
    },
  }
);

/* ============ Стилизованная секция (карточка с фоном) ============ */
export const StyledSectionBlock = createReactBlockSpec(
  {
    type: 'styledSection',
    propSchema: {
      bgColor: { default: '#f8fafc' },
      bgImage: { default: '' },
      padding: { default: 24 },
      borderRadius: { default: 16 },
      textColor: { default: '#0f172a' },
      overlay: { default: 0 },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const p = block.props as {
        bgColor: string;
        bgImage: string;
        padding: number;
        borderRadius: number;
        textColor: string;
        overlay: number;
      };

      const sectionStyle: React.CSSProperties = {
        background: p.bgColor || '#f8fafc',
        borderRadius: p.borderRadius,
        padding: p.padding,
        color: p.textColor,
        position: 'relative',
        overflow: 'hidden',
        margin: '16px 0',
        minHeight: 60,
      };

      if (p.bgImage) {
        sectionStyle.backgroundImage = `linear-gradient(rgba(0,0,0,${p.overlay / 100}), rgba(0,0,0,${p.overlay / 100})), url(${p.bgImage})`;
        sectionStyle.backgroundSize = 'cover';
        sectionStyle.backgroundPosition = 'center';
      }

      return (
        <div style={sectionStyle} className="bn-styled-section">
          <div ref={contentRef} className="bn-styled-section-content" />

          {editor.isEditable && (
            <div className="bn-styled-section-controls">
              <div className="bn-ss-row">
                <label className="bn-ss-label">
                  <span>Фон</span>
                  <input
                    type="color"
                    value={p.bgColor || '#f8fafc'}
                    onChange={(e) => editor.updateBlock(block, { props: { bgColor: e.target.value } })}
                  />
                </label>

                <label className="bn-ss-label">
                  <span>Текст</span>
                  <input
                    type="color"
                    value={p.textColor || '#0f172a'}
                    onChange={(e) => editor.updateBlock(block, { props: { textColor: e.target.value } })}
                  />
                </label>

                <label className="bn-ss-label bn-ss-slider">
                  <span>Отступ {p.padding}px</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={4}
                    value={p.padding}
                    onChange={(e) => editor.updateBlock(block, { props: { padding: Number(e.target.value) } })}
                  />
                </label>

                <label className="bn-ss-label bn-ss-slider">
                  <span>Скругление {p.borderRadius}px</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={2}
                    value={p.borderRadius}
                    onChange={(e) => editor.updateBlock(block, { props: { borderRadius: Number(e.target.value) } })}
                  />
                </label>
              </div>

              <div className="bn-ss-row">
                <input
                  className="bn-ss-input"
                  type="text"
                  placeholder="URL фоновой картинки (или загрузите ниже)"
                  value={p.bgImage}
                  onChange={(e) => editor.updateBlock(block, { props: { bgImage: e.target.value } })}
                />
                <label className="bn-ss-btn" style={{ cursor: 'pointer', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                  📷 Загрузить
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) {
                        alert('Это не изображение');
                        return;
                      }
                      try {
                        const dataUrl = await fileToDataURL(file);
                        editor.updateBlock(block, { props: { bgImage: dataUrl } });
                      } catch (err) {
                        alert((err as Error).message);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {p.bgImage && (
                  <>
                    <label className="bn-ss-label bn-ss-slider" style={{ flex: 1 }}>
                      <span>Затемнение {p.overlay}%</span>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        step={5}
                        value={p.overlay}
                        onChange={(e) => editor.updateBlock(block, { props: { overlay: Number(e.target.value) } })}
                      />
                    </label>
                    <button
                      type="button"
                      className="bn-ss-btn"
                      onClick={() => editor.updateBlock(block, { props: { bgImage: '', overlay: 0 } })}
                    >
                      × Убрать
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    },
  }
);

/* ============ Хелперы ============ */
function variantIcon(variant: string): string {
  switch (variant) {
    case 'success': return '✓';
    case 'warning': return '⚠';
    case 'tip':     return '💡';
    default:        return 'ℹ';
  }
}

function safeParseOptions(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch { /* ignore */ }
  return ['Вариант 1', 'Вариант 2'];
}