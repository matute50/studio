"use client";

import dynamic from 'next/dynamic';

const EditorNoticiasClient = dynamic(() => import('@/components/editor-noticias-client'), { ssr: false });

export default function EditorNoticiasPage() {
  return <EditorNoticiasClient />;
}
