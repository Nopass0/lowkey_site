'use client'

import { MindmapEditor } from '@/components/mindmap/mindmap-editor'

export default function MindmapEditorPage({ params }: { params: { id: string } }) {
  return <MindmapEditor mapId={params.id} />
}
