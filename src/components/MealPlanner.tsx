import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Sun, Moon, Info, CheckCircle2 } from 'lucide-react';
import { MealPlan } from '../types';
import { getLocalDateKey } from '../utils/date';

interface Props {
  meals: Record<string, MealPlan>;
  onUpdateMeal: (dateStr: string, field: keyof MealPlan, value: string) => void;
}

export default function MealPlanner({ meals, onUpdateMeal }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayDateKey = getLocalDateKey(new Date());

  const getWeekDays = (date: Date): Date[] => {
    const days: Date[] = [];
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);

  const prevWeek = (): void => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = (): void => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleMealChange = (dateStr: string, field: keyof MealPlan, value: string): void => {
    onUpdateMeal(dateStr, field, value);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-stone-200 bg-white px-3 py-3 shadow-sm sm:px-4 lg:px-5">
        <div className="flex items-center justify-between gap-2 rounded-[20px] bg-stone-50 px-2 py-2 sm:px-3">
          <button
            onClick={prevWeek}
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white hover:text-stone-900"
            aria-label="Previous week"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Weekly Meal Plan</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900 sm:text-2xl">
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </h2>
          </div>
          <button
            onClick={nextWeek}
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white hover:text-stone-900"
            aria-label="Next week"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {weekDays.map((day) => {
          const dateStr = getLocalDateKey(day);
          const isToday = dateStr === todayDateKey;
          const dayMeals = meals[dateStr] || { morning: '', evening: '', notes: '', leftovers: '' };

          return (
            <section
              key={dateStr}
              className={`flex h-full flex-col rounded-[24px] border p-4 shadow-sm transition-colors sm:p-5 ${
                isToday
                  ? 'border-orange-300 bg-gradient-to-b from-orange-50 via-white to-white shadow-orange-100/80'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.22em] ${
                      isToday ? 'text-orange-700' : 'text-stone-500'
                    }`}
                  >
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="mt-2 text-3xl font-semibold leading-none text-stone-900">{day.getDate()}</p>
                </div>
                {isToday ? (
                  <span className="rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                    Today
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex flex-1 flex-col gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Sun size={16} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Breakfast / Lunch</span>
                  </div>
                  <textarea
                    value={dayMeals.morning}
                    onChange={(event) => handleMealChange(dateStr, 'morning', event.target.value)}
                    placeholder="Plan morning/lunch..."
                    className="min-h-28 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-[15px] leading-6 text-stone-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Moon size={16} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Dinner</span>
                  </div>
                  <textarea
                    value={dayMeals.evening}
                    onChange={(event) => handleMealChange(dateStr, 'evening', event.target.value)}
                    placeholder="Dinner"
                    className="min-h-28 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-[15px] leading-6 text-stone-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                <div className="mt-auto rounded-[20px] border border-stone-200/80 bg-stone-50/80 p-3.5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Details</p>
                  <div className="space-y-3">
                    <label className="relative block">
                      <CheckCircle2 size={15} className="absolute left-3 top-3 text-emerald-500" />
                      <input
                        type="text"
                        value={dayMeals.leftovers || ''}
                        onChange={(event) => handleMealChange(dateStr, 'leftovers', event.target.value)}
                        placeholder="Leftovers"
                        className="w-full rounded-xl border border-emerald-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="relative block">
                      <Info size={15} className="absolute left-3 top-3 text-sky-500" />
                      <input
                        type="text"
                        value={dayMeals.notes || ''}
                        onChange={(event) => handleMealChange(dateStr, 'notes', event.target.value)}
                        placeholder="Notes"
                        className="w-full rounded-xl border border-sky-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
