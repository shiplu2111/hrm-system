import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import {
  AlertCircle,
  Bold,
  ClipboardType,
  Code2,
  Columns,
  FileCode2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Rows,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import { isSafeCmsLinkUrl } from '@hrm/shared-types';
import { hasExplicitPlatformPermission, type PermissionUser } from '@/lib/permissions';
import {
  MediaLibraryPickerModal,
  type SelectedMediaInsertion,
} from './MediaLibraryPickerModal';
import {
  countWordsAndChars,
  plainTextToSafeHtml,
  stripWordAndWebPasteJunk,
  validateCmsLinkInput,
} from './rich-text-utils';

export interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string, jsonSnapshot?: Record<string, unknown>) => void;
  onBlur?: () => void;
  locale?: 'en' | 'bn';
  placeholder?: string;
  readOnly?: boolean;
  mediaFolder?: string;
  currentUser?: PermissionUser;
  allowRawHtml?: boolean;
  ariaLabel?: string;
  minHeightClassName?: string;
  className?: string;
}

const CmsImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-media-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) =>
          attributes['data-media-id']
            ? { 'data-media-id': String(attributes['data-media-id']) }
            : {},
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) =>
          attributes.height ? { height: String(attributes.height) } : {},
      },
    };
  },
});

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      data-rte-tool="true"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 min-w-[2rem] px-2 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-35 disabled:cursor-not-allowed ${
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))]'
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  locale = 'en',
  placeholder,
  readOnly = false,
  mediaFolder = 'pages',
  currentUser,
  allowRawHtml = false,
  ariaLabel,
  minHeightClassName = 'min-h-[260px]',
  className = '',
}: RichTextEditorProps) {
  const canEditRawHtml =
    allowRawHtml && hasExplicitPlatformPermission(currentUser, 'cms', 'raw_html');

  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [rawHtmlMode, setRawHtmlMode] = useState(false);
  const [rawDraftHtml, setRawDraftHtml] = useState(value);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // IME & controlled-value guards (critical for Bengali Avro/Bijoy/Gboard input)
  const isComposingRef = useRef(false);
  const lastEmittedHtmlRef = useRef(value);
  const pasteAsPlainTextRef = useRef(pasteAsPlainText);
  pasteAsPlainTextRef.current = pasteAsPlainText;
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const resolvedPlaceholder =
    placeholder ??
    (locale === 'bn'
      ? 'বাংলা বা ইংরেজিতে কনটেন্ট লিখুন...'
      : 'Write or paste formatted content...');

  const editor = useEditor(
    {
      editable: !readOnly && !rawHtmlMode,
      content: value || '',
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          link: false,
          underline: false,
          codeBlock: {
            HTMLAttributes: { class: 'cms-rte-code-block' },
          },
          blockquote: {
            HTMLAttributes: { class: 'cms-rte-blockquote' },
          },
          horizontalRule: {
            HTMLAttributes: { class: 'cms-rte-hr' },
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: false,
          protocols: ['https', 'http', 'mailto'],
          isAllowedUri: (url) => isSafeCmsLinkUrl(url),
          HTMLAttributes: {
            rel: 'noopener noreferrer',
          },
        }),
        CmsImageExtension.configure({
          inline: false,
          allowBase64: false,
        }),
        Table.configure({
          resizable: false,
          HTMLAttributes: { class: 'cms-rte-table' },
        }),
        TableRow,
        TableHeader,
        TableCell,
        CharacterCount,
        Placeholder.configure({
          placeholder: resolvedPlaceholder,
        }),
      ],
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': ariaLabel || (locale === 'bn' ? 'Bengali rich text editor' : 'Rich text editor'),
          lang: locale,
          // Explicit LTR for Bengali to avoid punctuation flips while keeping bidi isolation safe
          dir: locale === 'bn' ? 'ltr' : 'auto',
          spellcheck: locale === 'bn' ? 'false' : 'true',
          class: `cms-rte-prosemirror ${minHeightClassName} w-full px-4 py-3 text-sm text-[rgb(var(--text-primary))] focus:outline-none`,
        },
        transformPastedHTML: (html) => stripWordAndWebPasteJunk(html),
        handlePaste: (view, event) => {
          if (!pasteAsPlainTextRef.current) {
            return false;
          }
          const plain = event.clipboardData?.getData('text/plain');
          if (typeof plain !== 'string') {
            return false;
          }
          event.preventDefault();
          const safeParagraphHtml = plainTextToSafeHtml(plain);
          if (editor) {
            editor.chain().focus().insertContent(safeParagraphHtml).run();
          } else {
            const { tr } = view.state;
            view.dispatch(tr.insertText(plain));
          }
          return true;
        },
        handleDOMEvents: {
          compositionstart: () => {
            isComposingRef.current = true;
            return false;
          },
          compositionend: () => {
            isComposingRef.current = false;
            return false;
          },
        },
      },
      onUpdate: ({ editor: instance }) => {
        // Defer emitting during IME composition? No — keep React state updated only safely after
        // or guard external setContent so composition never resets!
        if (isComposingRef.current || instance.view?.composing) {
          return;
        }
        const nextHtml = stripWordAndWebPasteJunk(instance.getHTML());
        lastEmittedHtmlRef.current = nextHtml;
        onChange(nextHtml, instance.getJSON() as Record<string, unknown>);
      },
      onBlur: () => {
        if (editor && !isComposingRef.current) {
          const nextHtml = stripWordAndWebPasteJunk(editor.getHTML());
          if (nextHtml !== lastEmittedHtmlRef.current) {
            lastEmittedHtmlRef.current = nextHtml;
            onChange(nextHtml, editor.getJSON() as Record<string, unknown>);
          }
        }
        onBlur?.();
      },
    },
    [locale],
  );

  // Guarded external value synchronization — never resets cursor or active Bengali IME composition
  useEffect(() => {
    if (!editor) return;
    if (isComposingRef.current || editor.view?.composing) return;
    if (value === lastEmittedHtmlRef.current) return;

    const currentHtml = stripWordAndWebPasteJunk(editor.getHTML());
    const incomingNormalized = stripWordAndWebPasteJunk(value || '');
    if (incomingNormalized !== currentHtml) {
      editor.commands.setContent(incomingNormalized, { emitUpdate: false });
      lastEmittedHtmlRef.current = incomingNormalized;
    }
    setRawDraftHtml(value || '');
  }, [editor, value]);

  // Keep editable synced if readOnly or rawHtmlMode changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !rawHtmlMode);
  }, [editor, readOnly, rawHtmlMode]);

  // Defensive: ensure rawHtmlMode closes if permission disappears
  useEffect(() => {
    if (!canEditRawHtml && rawHtmlMode) {
      setRawHtmlMode(false);
    }
  }, [canEditRawHtml, rawHtmlMode]);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor;
      if (!ed) {
        return {
          headingLevel: 0,
          isBold: false,
          isItalic: false,
          isUnderline: false,
          isCode: false,
          isBulletList: false,
          isOrderedList: false,
          isBlockquote: false,
          isLink: false,
          isInTable: false,
          canUndo: false,
          canRedo: false,
          plainText: '',
        };
      }

      let headingLevel = 0;
      for (const lvl of [1, 2, 3, 4, 5, 6] as const) {
        if (ed.isActive('heading', { level: lvl })) {
          headingLevel = lvl;
          break;
        }
      }

      return {
        headingLevel,
        isBold: ed.isActive('bold'),
        isItalic: ed.isActive('italic'),
        isUnderline: ed.isActive('underline'),
        isCode: ed.isActive('code'),
        isBulletList: ed.isActive('bulletList'),
        isOrderedList: ed.isActive('orderedList'),
        isBlockquote: ed.isActive('blockquote'),
        isLink: ed.isActive('link'),
        isInTable: ed.isActive('table'),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        plainText: ed.state.doc.textBetween(0, ed.state.doc.content.size, ' ', ' '),
      };
    },
  });

  const stats = useMemo(() => {
    const sourceText = rawHtmlMode
      ? rawDraftHtml.replace(/<[^>]+>/g, ' ')
      : editorState?.plainText ?? '';
    return countWordsAndChars(sourceText, locale);
  }, [rawHtmlMode, rawDraftHtml, editorState?.plainText, locale]);

  // Accessible roving keyboard navigation along the toolbar
  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      return;
    }
    const container = toolbarRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-rte-tool="true"]:not([disabled]), select:not([disabled])',
      ),
    );
    if (focusables.length === 0) return;

    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return;

    // Preserve native select Up/Down behavior while allowing Left/Right navigation cleanly
    e.preventDefault();
    let nextIdx = currentIndex;
    if (e.key === 'ArrowRight') nextIdx = (currentIndex + 1) % focusables.length;
    else if (e.key === 'ArrowLeft') nextIdx = (currentIndex - 1 + focusables.length) % focusables.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = focusables.length - 1;

    focusables[nextIdx]?.focus();
  }, []);

  const openLinkDialog = () => {
    if (!editor) return;
    const currentAttrs = editor.getAttributes('link') as { href?: string; target?: string };
    setLinkUrlInput(currentAttrs.href || '');
    setLinkNewTab(currentAttrs.target === '_blank');
    setLinkError(null);
    setLinkDialogOpen(true);
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const validation = validateCmsLinkInput(linkUrlInput);
    if (!validation.valid) {
      setLinkError(validation.error || 'Invalid URL');
      return;
    }

    const attrs: { href: string; target?: string; rel: string } = {
      href: validation.normalizedUrl,
      rel: 'noopener noreferrer',
      ...(linkNewTab ? { target: '_blank' } : {}),
    };

    if (editor.state.selection.empty && !editor.isActive('link')) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: validation.normalizedUrl,
          marks: [{ type: 'link', attrs }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
    }

    setLinkDialogOpen(false);
    setLinkError(null);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkDialogOpen(false);
    setLinkError(null);
  };

  const handleMediaSelect = (selection: SelectedMediaInsertion) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: selection.src,
        alt: selection.alt,
        title: selection.title,
      })
      .updateAttributes('image', {
        'data-media-id': selection.media.id,
        ...(selection.width ? { width: String(selection.width) } : {}),
        ...(selection.height ? { height: String(selection.height) } : {}),
      })
      .run();
  };

  const toggleRawHtmlMode = () => {
    if (!canEditRawHtml || !editor) return;
    if (!rawHtmlMode) {
      setRawDraftHtml(stripWordAndWebPasteJunk(editor.getHTML()));
      setRawHtmlMode(true);
    } else {
      const cleaned = stripWordAndWebPasteJunk(rawDraftHtml);
      lastEmittedHtmlRef.current = cleaned;
      editor.commands.setContent(cleaned, { emitUpdate: false });
      onChange(cleaned, editor.getJSON() as Record<string, unknown>);
      setRawHtmlMode(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label={ariaLabel ? `${ariaLabel} formatting toolbar` : 'Rich text formatting toolbar'}
        onKeyDown={handleToolbarKeyDown}
        className="flex flex-wrap items-center gap-1 px-2.5 py-2 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]"
      >
        {/* Heading / Paragraph select */}
        <select
          aria-label="Text block level"
          disabled={readOnly || rawHtmlMode}
          value={editorState?.headingLevel ?? 0}
          onChange={(e) => {
            if (!editor) return;
            const lvl = Number(e.target.value);
            if (lvl === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor
                .chain()
                .focus()
                .toggleHeading({ level: lvl as 1 | 2 | 3 | 4 | 5 | 6 })
                .run();
            }
          }}
          className="h-8 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-40"
        >
          <option value={0}>Paragraph</option>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
          <option value={4}>Heading 4</option>
          <option value={5}>Heading 5</option>
          <option value={6}>Heading 6</option>
        </select>

        <span className="h-5 w-px bg-[rgb(var(--border-base))] mx-0.5" aria-hidden="true" />

        {/* Inline formatting */}
        <ToolbarButton
          label="Bold (Ctrl+B)"
          active={Boolean(editorState?.isBold)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Italic (Ctrl+I)"
          active={Boolean(editorState?.isItalic)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Underline (Ctrl+U)"
          active={Boolean(editorState?.isUnderline)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Inline Code"
          active={Boolean(editorState?.isCode)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="h-5 w-px bg-[rgb(var(--border-base))] mx-0.5" aria-hidden="true" />

        {/* Lists & Blocks */}
        <ToolbarButton
          label="Bulleted List"
          active={Boolean(editorState?.isBulletList)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Numbered List"
          active={Boolean(editorState?.isOrderedList)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Blockquote"
          active={Boolean(editorState?.isBlockquote)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Horizontal Rule"
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="h-5 w-px bg-[rgb(var(--border-base))] mx-0.5" aria-hidden="true" />

        {/* Links, Tables, Media Library Image */}
        <ToolbarButton
          label="Insert or Edit Link"
          active={Boolean(editorState?.isLink)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={openLinkDialog}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {editorState?.isLink && !rawHtmlMode && !readOnly && (
          <ToolbarButton
            label="Remove Link"
            onClick={removeLink}
          >
            <Unlink className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}

        <ToolbarButton
          label="Insert Table (3x3)"
          active={Boolean(editorState?.isInTable)}
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Insert Image from Media Library"
          disabled={readOnly || rawHtmlMode || !editor}
          onClick={() => setMediaModalOpen(true)}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Media</span>
        </ToolbarButton>

        <span className="h-5 w-px bg-[rgb(var(--border-base))] mx-0.5" aria-hidden="true" />

        {/* Paste as plain text + Undo/Redo */}
        <ToolbarButton
          label="Paste as Plain Text"
          active={pasteAsPlainText}
          disabled={readOnly || rawHtmlMode}
          onClick={() => setPasteAsPlainText((prev) => !prev)}
        >
          <ClipboardType className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Plain Paste</span>
        </ToolbarButton>

        <ToolbarButton
          label="Undo (Ctrl+Z)"
          disabled={readOnly || rawHtmlMode || !editorState?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          label="Redo (Ctrl+Shift+Z)"
          disabled={readOnly || rawHtmlMode || !editorState?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Raw HTML Toggle: strictly gated behind explicit cms:raw_html permission */}
        {canEditRawHtml && !readOnly && (
          <>
            <span className="h-5 w-px bg-[rgb(var(--border-base))] mx-0.5" aria-hidden="true" />
            <ToolbarButton
              label="Toggle Raw HTML Mode (Explicit Permission Required)"
              active={rawHtmlMode}
              onClick={toggleRawHtmlMode}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">HTML</span>
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Contextual Table Sub-Toolbar */}
      {editorState?.isInTable && !rawHtmlMode && !readOnly && (
        <div
          role="toolbar"
          aria-label="Table controls"
          className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/60 text-[11px]"
        >
          <span className="font-semibold text-[rgb(var(--text-secondary))] mr-1 inline-flex items-center gap-1">
            <TableIcon className="h-3 w-3" /> Table:
          </span>
          <button
            type="button"
            onClick={() => editor?.chain().focus().addRowAfter().run()}
            className="px-2 py-1 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            <Rows className="h-3 w-3" />
            Row
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().deleteRow().run()}
            className="px-2 py-1 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center gap-1"
          >
            Delete Row
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
            className="px-2 py-1 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            <Columns className="h-3 w-3" />
            Column
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().deleteColumn().run()}
            className="px-2 py-1 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center gap-1"
          >
            Delete Column
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().deleteTable().run()}
            className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 inline-flex items-center gap-1 ml-auto"
          >
            <Trash2 className="h-3 w-3" />
            Delete Table
          </button>
        </div>
      )}

      {/* Inline Link Validation Popover */}
      {linkDialogOpen && (
        <form
          onSubmit={applyLink}
          className="px-3.5 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-elevated))] flex flex-wrap items-center gap-2"
        >
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={linkUrlInput}
              onChange={(e) => {
                setLinkUrlInput(e.target.value);
                if (linkError) setLinkError(null);
              }}
              placeholder="https://example.com, /pricing, or mailto:team@example.com"
              aria-label="Link URL"
              autoFocus
              className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            />
            {linkError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {linkError}
              </p>
            )}
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-secondary))] cursor-pointer">
            <input
              type="checkbox"
              checked={linkNewTab}
              onChange={(e) => setLinkNewTab(e.target.checked)}
              className="rounded border-[rgb(var(--border-strong))] text-primary-600 focus:ring-primary-600"
            />
            Open in new tab
          </label>

          <button
            type="submit"
            className="h-8 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkDialogOpen(false);
              setLinkError(null);
            }}
            className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Editor Surface or Gated Raw HTML Surface */}
      {rawHtmlMode && canEditRawHtml ? (
        <div className="bg-[rgb(var(--bg-surface))]">
          <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>
              Raw HTML mode enabled via explicit <code>cms:raw_html</code> grant. All markup is still
              allowlist-sanitized on the server upon save.
            </span>
          </div>
          <textarea
            value={rawDraftHtml}
            onChange={(e) => {
              const raw = e.target.value;
              setRawDraftHtml(raw);
              const cleaned = stripWordAndWebPasteJunk(raw);
              lastEmittedHtmlRef.current = cleaned;
              onChange(cleaned);
            }}
            onBlur={onBlur}
            spellCheck={false}
            aria-label="Raw CMS HTML source"
            className={`${minHeightClassName} w-full p-4 font-mono text-xs bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] focus:outline-none resize-y`}
          />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      {/* Status & Word/Character Counter Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] text-[11px] text-[rgb(var(--text-muted))]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[rgb(var(--text-secondary))]">
            {stats.words} {stats.words === 1 ? 'word' : 'words'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {stats.characters} {stats.characters === 1 ? 'character' : 'characters'}
          </span>
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] uppercase text-[10px] font-mono">
            {locale}
          </span>
          {pasteAsPlainText && (
            <span className="px-1.5 py-0.5 rounded bg-primary-600/15 text-primary-700 dark:text-primary-300 font-medium">
              Plain-Text Paste ON
            </span>
          )}
        </div>

        <span className="text-[10px]">
          {canEditRawHtml
            ? 'Raw HTML permission active (server-sanitized)'
            : 'Allowlist HTML output · Paste formatting auto-cleaned'}
        </span>
      </div>

      {/* Media Library Picker Modal (Stage C.1) */}
      <MediaLibraryPickerModal
        isOpen={mediaModalOpen}
        locale={locale}
        defaultFolder={mediaFolder}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
