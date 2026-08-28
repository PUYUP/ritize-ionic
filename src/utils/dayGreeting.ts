type GreetingLocale = 'id' | 'en'

interface GreetingOptions {
    locale?: GreetingLocale
    date?: Date
}

const GREETINGS: Record<GreetingLocale, Record<'morning' | 'afternoon' | 'evening' | 'night', string>> = {
    id: {
        morning: 'Selamat pagi',
        afternoon: 'Selamat siang',
        evening: 'Selamat sore',
        night: 'Selamat malam',
    },
    en: {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
        night: 'Good night',
    },
}

export function getGreeting({ locale = 'id', date = new Date() }: GreetingOptions = {}): string {
    const hour = date.getHours()
    const g = GREETINGS[locale]

    if (hour >= 5 && hour < 11) return g.morning
    if (hour >= 11 && hour < 15) return g.afternoon
    if (hour >= 15 && hour < 18) return g.evening
    return g.night
}

// Opsional: langsung gabung dengan nama
export function getGreetingWithName(name: string, options?: GreetingOptions): string {
    return `${getGreeting(options)}, ${name}`
}