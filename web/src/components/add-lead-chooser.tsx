"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { FileUpIcon, FormIcon } from "./icons";
import { Modal } from "./ui";

function Choice({ icon: Icon, title, text, onClick }: { icon: ComponentType<{ size?: number }>; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-card border border-frame bg-card p-4 text-left hover:border-accent hover:bg-accent-soft"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-press">
        <Icon size={26} />
      </span>
      <span>
        <span className="block text-title font-semibold">{title}</span>
        <span className="mt-1 block text-small text-muted">{text}</span>
      </span>
    </button>
  );
}

/** Premier écran de « Ajouter un lead » : saisie à la main, ou chargement d'un fichier JSON / CSV. */
export function AddLeadChooser({ onManual, onFile, onClose }: { onManual: () => void; onFile: () => void; onClose: () => void }) {
  return (
    <Modal title="Ajouter des leads" description="Comment voulez-vous les ajouter ?" onClose={onClose} width="max-w-[560px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice icon={FormIcon} title="Remplir manuellement" text="Un lead à la fois, avec son adresse, ses contacts et sa position sur la carte." onClick={onManual} />
        <Choice icon={FileUpIcon} title="Charger un fichier" text="Un fichier JSON ou CSV, jusqu’à 1 000 leads, avec une analyse avant l’import." onClick={onFile} />
      </div>
      <p className="mt-4 text-small text-muted">
        Un fichier à préparer ?{" "}
        <Link href="/docs/import" target="_blank" className="font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
          Voir le format attendu
        </Link>
      </p>
    </Modal>
  );
}
