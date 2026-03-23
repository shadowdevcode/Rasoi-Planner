import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Sun, Moon, Info, CheckCircle2 } from 'lucide-react';
import { MealPlan } from '../types';

interface Props {
  meals: Record<string, MealPlan>;
  onUpdateMeal: (dateStr: string, field: keyof MealPlan, value: string) => void;
}

export default function MealPlanner({ meals, onUpdateMeal }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getWeekDays = (date: Date) => {
    const days = [];
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);

  const prevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleMealChange = (dateStr: string, field: keyof MealPlan, value: string) => {
    onUpdateMeal(dateStr, field, value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-stone-50 p-4 rounded-xl border border-stone-200">
        <button onClick={prevWeek} className="p-2 rounded-full hover:bg-stone-200 transition-colors">
          <ChevronLeft size={24} className="text-stone-600" />
        </button>
        <h2 className="text-xl font-bold text-stone-800">
          Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </h2>
        <button onClick={nextWeek} className="p-2 rounded-full hover:bg-stone-200 transition-colors">
          <ChevronRight size={24} className="text-stone-600" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const dayMeals = meals[dateStr] || { morning: '', evening: '', notes: '', leftovers: '' };

          return (
            <div
              key={dateStr}
              className={`flex flex-col rounded-2xl border ${
                isToday ? 'border-orange-500 bg-orange-50/30 shadow-md' : 'border-stone-200 bg-white'
              } overflow-hidden`}
            >
              <div className={`p-3 text-center border-b ${isToday ? 'bg-orange-100 border-orange-200 text-orange-800' : 'bg-stone-50 border-stone-200 text-stone-600'}`}>
                <p className="text-xs font-bold uppercase tracking-wider">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                <p className="text-lg font-bold">{day.getDate()}</p>
              </div>
              
              <div className="p-3 space-y-4 flex-grow">
                {/* Morning */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-yellow-600">
                    <Sun size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide">Morning</span>
                  </div>
                  <textarea
                    value={dayMeals.morning}
                    onChange={(e) => handleMealChange(dateStr, 'morning', e.target.value)}
                    placeholder="Plan morning/lunch..."
                    className="w-full text-sm p-2 rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none h-20"
                  />
                </div>

                {/* Evening */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-indigo-600">
                    <Moon size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide">Evening</span>
                  </div>
                  <textarea
                    value={dayMeals.evening}
                    onChange={(e) => handleMealChange(dateStr, 'evening', e.target.value)}
                    placeholder="Plan evening..."
                    className="w-full text-sm p-2 rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none h-20"
                  />
                </div>

                {/* Leftovers & Notes */}
                <div className="pt-2 border-t border-stone-100 space-y-3">
                  <div className="relative">
                    <CheckCircle2 size={14} className="absolute left-2 top-2.5 text-emerald-500" />
                    <input
                      type="text"
                      value={dayMeals.leftovers || ''}
                      onChange={(e) => handleMealChange(dateStr, 'leftovers', e.target.value)}
                      placeholder="Use leftovers..."
                      className="w-full text-xs pl-7 pr-2 py-2 rounded-lg border border-emerald-200 bg-emerald-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Info size={14} className="absolute left-2 top-2.5 text-blue-500" />
                    <input
                      type="text"
                      value={dayMeals.notes || ''}
                      onChange={(e) => handleMealChange(dateStr, 'notes', e.target.value)}
                      placeholder="Special instructions..."
                      className="w-full text-xs pl-7 pr-2 py-2 rounded-lg border border-blue-200 bg-blue-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
