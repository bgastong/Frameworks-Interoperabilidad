"use client"

// ** Imports: React & Hooks **
import React, { useEffect, useRef, useState } from "react"

import {
  canalesDeComunidad,
  misMembresias,
  type Canal,
  type Comunidad,
  type RolMembresia,
} from "@/lib/comunidades"
import { CanalDialog, type CanalDialogMode } from "@/components/canal-dialog"
import { ComunidadDialog, type ComunidadDialogMode } from "@/components/comunidad-dialog"
import { ComunidadView } from "@/components/comunidad-view"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { CanalesLista } from "@/components/sidebar/canales-lista"
import { BotonMenu } from "@/components/sidebar/menu-mobile"

type CargaCanales = {
  comunidadId: string
  canales: Canal[]
  error: string
}

// ** Home Component **
export const Home = () => {
  const [revision, setRevision] = useState(0)
  const seleccion = useRef<string | null>(null)
  const [dialogo, setDialogo] = useState<ComunidadDialogMode | null>(null)
  const [comunidades, setComunidades] = useState<Comunidad[]>([])
  const [roles, setRoles] = useState<Record<string, RolMembresia>>({})
  const [cargandoComunidades, setCargandoComunidades] = useState(true)
  const [errorComunidades, setErrorComunidades] = useState("")
  const [comunidadActiva, setComunidadActiva] = useState<Comunidad | null>(null)
  const [carga, setCarga] = useState<CargaCanales | null>(null)
  const [canalId, setCanalId] = useState<string | null>(null)
  const [canalesAbiertos, setCanalesAbiertos] = useState(true)
  const [dialogoCanal, setDialogoCanal] = useState<{ mode: CanalDialogMode; canal: Canal | null } | null>(null)

  const comunidadId = comunidadActiva?.documentId ?? null
  const cargaActual = carga && carga.comunidadId === comunidadId ? carga : null
  const canales = cargaActual?.canales ?? []
  const estadoCanales = !cargaActual ? "cargando" : cargaActual.error ? "error" : "listo"
  const canalActivo = canales.find((canal) => canal.documentId === canalId) ?? canales[0] ?? null

  useEffect(() => {
    let vigente = true
    misMembresias()
      .then((membresias) => {
        if (!vigente) return
        const propias = membresias.flatMap(({ comunidad, rol }) => (comunidad ? [{ comunidad, rol }] : []))
        setComunidades(propias.map(({ comunidad }) => comunidad))
        setErrorComunidades("")
        setComunidadActiva((actual) => actual
          ? propias.find(({ comunidad }) => comunidad.documentId === actual.documentId)?.comunidad ?? null
          : null)
        setRoles(Object.fromEntries(propias.map(({ comunidad, rol }) => [comunidad.documentId, rol])))
        // El enlace de un push solo selecciona comunidades que devuelve la API
        // autenticada. El backend vuelve a comprobar el acceso al canal.
        const target = new URLSearchParams(window.location.search)
        const requested = propias.find(({ comunidad }) => comunidad.documentId === target.get('comunidad'))
        if (requested && !seleccion.current) {
          seleccion.current = requested.comunidad.documentId
          setComunidadActiva(requested.comunidad)
          setCanalId(target.get('canal'))
        }
      })
      .catch((err) => { if (vigente) setErrorComunidades(err.message) })
      .finally(() => { if (vigente) setCargandoComunidades(false) })
    return () => { vigente = false }
  }, [revision])

  useEffect(() => {
    if (!comunidadId) return
    let vigente = true

    canalesDeComunidad(comunidadId)
      .then((resultado) => {
        if (vigente) setCarga({ comunidadId, canales: resultado, error: "" })
      })
      .catch((err) => {
        if (vigente) setCarga({ comunidadId, canales: [], error: err.message })
      })

    return () => {
      vigente = false
    }
  }, [comunidadId, revision])

  function seleccionarComunidad(comunidad: Comunidad) {
    if (comunidad.documentId === comunidadId) {
      setCanalesAbiertos((abiertos) => !abiertos)
    } else {
      seleccion.current = comunidad.documentId
      setCanalId(null)
      setDialogoCanal(null)
      setComunidadActiva(comunidad)
      setCanalesAbiertos(true)
    }
  }

  function aplicarCambioDeCanal(mode: CanalDialogMode, canal: Canal) {
    if (!cargaActual || seleccion.current !== comunidadId) return
    const actualizados =
      mode === "crear"
        ? [...canales, canal]
        : mode === "renombrar"
          ? canales.map((c) => (c.documentId === canal.documentId ? canal : c))
          : canales.filter((c) => c.documentId !== canal.documentId)
    setCarga({ ...cargaActual, canales: actualizados })
    if (mode !== "eliminar") setCanalId(canal.documentId)
  }

  function actualizar() {
    setCarga(null)
    setCargandoComunidades(true)
    setRevision((actual) => actual + 1)
  }

  const esPropietario = comunidadId !== null && roles[comunidadId] === "propietario"

  const vistaPrincipal = comunidadActiva ? (
    <ComunidadView
      key={`${comunidadActiva.documentId}:${revision}`}
      comunidad={comunidadActiva}
      canal={canalActivo}
      rol={comunidadId ? roles[comunidadId] : undefined}
      estado={errorComunidades ? "error" : estadoCanales}
      error={errorComunidades || cargaActual?.error || ""}
      onActualizar={actualizar}
    />
  ) : (
    <div className="flex h-dvh flex-col">
      {/* Sin comunidad elegida no hay encabezado: en mobile hace falta el ☰ para abrir el menu */}
      <div className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
        <BotonMenu />
      </div>
      {errorComunidades ? (
        <p role="alert" className="flex flex-grow items-center justify-center p-6 text-center text-destructive">
          {errorComunidades}
          <button type="button" onClick={actualizar} className="ml-3 underline">Reintentar</button>
        </p>
      ) : cargandoComunidades ? (
        <p role="status" className="flex flex-grow items-center justify-center p-6 text-center text-muted-foreground">
          Cargando comunidades...
        </p>
      ) : (
        <div className="flex flex-grow items-center justify-center p-6 text-center text-muted-foreground">
          {comunidades.length === 0
            ? "Todavía no estás en ninguna comunidad. Creá una o unite a una existente con el botón +."
            : "Elegí una comunidad de la barra lateral."}
        </div>
      )}
    </div>
  )

  return (
    <>
      <AppSidebar
        comunidades={comunidades}
        comunidadActiva={comunidadActiva}
        onSelectComunidad={seleccionarComunidad}
        onAbrirDialogo={setDialogo}
        activaAbierta={canalesAbiertos}
        detalleActiva={
          <CanalesLista
            canales={canales}
            estado={estadoCanales}
            error={cargaActual?.error ?? ""}
            canalActivo={canalActivo}
            esPropietario={esPropietario}
            onSelect={(canal) => setCanalId(canal.documentId)}
            onCrear={() => setDialogoCanal({ mode: "crear", canal: null })}
            onAccion={(mode, canal) => setDialogoCanal({ mode, canal })}
          />
        }
      >
        {vistaPrincipal}
      </AppSidebar>

      {comunidadId && (
        <CanalDialog
          mode={dialogoCanal?.mode ?? null}
          comunidadDocumentId={comunidadId}
          canal={dialogoCanal?.canal ?? null}
          onClose={() => setDialogoCanal(null)}
          onDone={aplicarCambioDeCanal}
        />
      )}

      <ComunidadDialog
        mode={dialogo}
        onClose={() => setDialogo(null)}
        onDone={(comunidad) => {
          setComunidades((prev) => [...prev, comunidad])
          setRoles((prev) => ({
            ...prev,
            [comunidad.documentId]: dialogo === "crear" ? "propietario" : "miembro",
          }))
          seleccion.current = comunidad.documentId
          setCanalId(null)
          setComunidadActiva(comunidad)
          setCanalesAbiertos(true)
        }}
      />
    </>
  )
}
