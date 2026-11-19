"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * O Sonner anuncia os avisos pela região aria-live que ele cria no carregamento, mas não dá papel
 * a cada aviso. Aqui cada um recebe role="status" (erro: "alert"), para leitores de tela e
 * para quem navega pela árvore de acessibilidade.
 */
function useToastRoles() {
  useEffect(() => {
    const region = document.querySelector("section[aria-live][aria-label^='Notifications']")
    if (!region) return
    const label = () => {
      region.querySelectorAll("[data-sonner-toast]:not([role])").forEach((toast) => {
        toast.setAttribute("role", toast.getAttribute("data-type") === "error" ? "alert" : "status")
      })
    }
    label()
    const observer = new MutationObserver(label)
    observer.observe(region, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  useToastRoles()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
