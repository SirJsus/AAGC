
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Calendar } from "lucide-react"
import { calculateAvailableSlots } from "@/lib/actions/appointments"
import { formatTimeForDisplay } from "@/lib/utils/timezone"

interface SlotPickerProps {
  doctorId: string
  clinicId: string
  date: string
  appointmentDurationMin: number
  selectedSlot?: { startTime: string; endTime: string } | null
  onSlotSelect: (slot: { startTime: string; endTime: string }) => void
}

interface TimeSlot {
  startTime: string
  endTime: string
}

export function SlotPicker({ 
  doctorId, 
  clinicId, 
  date, 
  appointmentDurationMin,
  selectedSlot,
  onSlotSelect 
}: SlotPickerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!doctorId || !date || !clinicId) {
      setSlots([])
      return
    }

    const loadSlots = async () => {
      setLoading(true)
      setError(null)

      try {
        const availableSlots = await calculateAvailableSlots({
          doctorId,
          date,
          clinicId,
          appointmentDurationMin,
        })
        setSlots(availableSlots)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load available slots')
        setSlots([])
      } finally {
        setLoading(false)
      }
    }

    loadSlots()
  }, [doctorId, date, clinicId, appointmentDurationMin])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Available Time Slots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Available Time Slots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Available Time Slots
        </CardTitle>
        <CardDescription>
          {date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(date).toLocaleDateString('es-MX', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {slots?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No available slots for the selected date and doctor.
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {slots?.map?.((slot, index) => {
              const isSelected = selectedSlot?.startTime === slot?.startTime && 
                               selectedSlot?.endTime === slot?.endTime
              
              return (
                <Button
                  key={`${slot?.startTime}-${index}`}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => onSlotSelect?.(slot)}
                >
                  {formatTimeForDisplay(slot?.startTime || "")}
                </Button>
              )
            }) || []}
          </div>
        )}
        
        {selectedSlot && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selected Time:</span>
              <Badge variant="default">
                {formatTimeForDisplay(selectedSlot.startTime)} - {formatTimeForDisplay(selectedSlot.endTime)}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
