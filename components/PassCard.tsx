"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Ticket, Beer, CheckCircle2 } from "lucide-react"

type PassCardProps = {
  pass: any
}

export function PassCard({ pass }: PassCardProps) {
  const [activeTab, setActiveTab] = useState<"entry" | "drink">("entry")

  // Check if drink tab should be available
  const hasDrink = pass.drink_status && pass.drink_status !== "none"

  return (
    <div
      className="rounded-[2rem] p-6 shadow-2xl flex flex-col w-full max-w-md mx-auto h-full"
      style={{ backgroundColor: "#121212", border: "1px solid #2a2a2a" }}
    >
      {/* Dual-tab toggle */}
      <div className="flex bg-[#1e1e1e] rounded-full p-1.5 mb-8 border border-[#2a2a2a]">
        <button
          onClick={() => setActiveTab("entry")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
            activeTab === "entry"
              ? "bg-[#DC143C] text-white shadow-lg"
              : "bg-transparent text-[#888888] hover:text-white"
          }`}
        >
          <Ticket size={18} />
          Entry
        </button>
        
        {hasDrink && (
          <button
            onClick={() => setActiveTab("drink")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
              activeTab === "drink"
                ? "bg-[#DC143C] text-white shadow-lg"
                : "bg-transparent text-[#888888] hover:text-white"
            }`}
          >
            <Beer size={18} />
            Drink
          </button>
        )}
      </div>

      {/* QR Code Content */}
      <div className="flex flex-col items-center justify-center flex-1 py-4">
        {activeTab === "entry" && (
          <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
            {pass.entry_status === "scanned" ? (
              <div className="flex flex-col items-center text-center mt-4">
                <div className="w-20 h-20 bg-[#1e1e1e] rounded-full flex items-center justify-center mb-6 border border-[#2a2a2a]">
                  <CheckCircle2 className="text-[#888888]" size={36} />
                </div>
                <h3 className="text-2xl font-extrabold text-[#eeeeee]">Entry Pass Used</h3>
                <p className="text-[#888888] mt-2 font-medium">Enjoy the event!</p>
              </div>
            ) : pass.entry_qr_uuid ? (
              <>
                <div className="bg-white p-5 rounded-[2rem] shadow-xl shadow-black/50">
                  <QRCodeSVG value={pass.entry_qr_uuid} size={220} />
                </div>
                <p className="mt-8 text-[#888888] text-sm font-medium tracking-wide uppercase">
                  Present at the entrance
                </p>
              </>
            ) : (
              <div className="w-[220px] h-[220px] bg-[#1e1e1e] rounded-[2rem] flex items-center justify-center text-[#888888]">
                Loading...
              </div>
            )}
          </div>
        )}

        {activeTab === "drink" && (
          <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
            {pass.drink_status === "scanned" ? (
              <div className="flex flex-col items-center text-center mt-4">
                <div className="w-20 h-20 bg-[#1e1e1e] rounded-full flex items-center justify-center mb-6 border border-[#2a2a2a]">
                  <CheckCircle2 className="text-[#888888]" size={36} />
                </div>
                <h3 className="text-2xl font-extrabold text-[#eeeeee]">Drink Pass Used</h3>
                <p className="text-[#888888] mt-2 font-medium">Cheers!</p>
              </div>
            ) : pass.drink_qr_uuid ? (
              <>
                <div className="bg-white p-5 rounded-[2rem] shadow-xl shadow-black/50">
                  <QRCodeSVG value={pass.drink_qr_uuid} size={220} />
                </div>
                <p className="mt-8 text-[#888888] text-sm font-medium tracking-wide uppercase">
                  {pass.drink_menus?.name || "Present at the bar"}
                </p>
              </>
            ) : (
              <div className="w-[220px] h-[220px] bg-[#1e1e1e] rounded-[2rem] flex items-center justify-center text-[#888888]">
                Loading...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
