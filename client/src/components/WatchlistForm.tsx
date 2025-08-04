import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Watchlist } from '@shared/schema';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface WatchlistFormProps {
  userId: string;
  existingWatchlist?: Watchlist | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormValues {
  destination: string;
  budget?: number;
  tripDuration?: number;
  priorities?: {
    hotelStars?: number;
    beachLine?: number;
    allInclusive?: number;
    reviews?: number;
    renovation?: number;
    animation?: number;
  };
  deadline?: Date;
  active: boolean;
}

const WatchlistForm = ({ userId, existingWatchlist, onSuccess, onCancel }: WatchlistFormProps) => {
  const { toast } = useToast();

  // Initialize form with existing watchlist data or defaults
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      destination: existingWatchlist?.destination || '',
      budget: existingWatchlist?.budget,
      tripDuration: existingWatchlist?.tripDuration || 7,
      priorities: existingWatchlist?.priorities || {
        hotelStars: 5,
        beachLine: 7,
        allInclusive: 8,
        reviews: 6,
        renovation: 4,
        animation: 5
      },
      deadline: existingWatchlist?.deadline ? new Date(existingWatchlist.deadline) : undefined,
      active: existingWatchlist?.active ?? true
    }
  });

  // Watch form values
  const watchBudget = watch('budget');
  const watchTripDuration = watch('tripDuration');
  const watchPriorities = watch('priorities');

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Include userId in the data
      const watchlistData = {
        ...data,
        userId
      };
      
      if (existingWatchlist) {
        // Update existing watchlist
        await apiRequest('PATCH', `/api/watchlist/${existingWatchlist.id}`, watchlistData);
      } else {
        // Create new watchlist
        await apiRequest('POST', '/api/submit-watchlist', watchlistData);
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting watchlist:', error);
      toast({
        title: "Ошибка при сохранении",
        description: error instanceof Error ? error.message : "Произошла ошибка при сохранении",
        variant: "destructive"
      });
    }
  };

  const handlePriorityChange = (key: keyof FormValues['priorities'], value: number[]) => {
    setValue(`priorities.${key}`, value[0]);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Destination Field */}
      <div>
        <Label htmlFor="destination" className="block text-sm font-medium mb-1">Направление</Label>
        <Input 
          id="destination" 
          type="text"
          {...register("destination", { required: "Направление обязательно" })}
          className="w-full"
          placeholder="Например: Мальдивы, Таиланд"
        />
        {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
      </div>
      
      {/* Budget Field */}
      <div>
        <Label htmlFor="budget" className="block text-sm font-medium mb-1">
          Бюджет (₽ на человека): {watchBudget?.toLocaleString() || 'Без ограничений'}
        </Label>
        <div className="flex items-center">
          <Slider
            id="budget"
            min={30000}
            max={300000}
            step={5000}
            defaultValue={watchBudget ? [watchBudget] : [100000]}
            onValueChange={(value) => setValue('budget', value[0])}
            className="flex-1"
          />
          <span className="ml-2 min-w-[80px] text-center">
            {watchBudget?.toLocaleString() || '—'} ₽
          </span>
        </div>
      </div>
      
      {/* Trip Duration */}
      <div>
        <Label htmlFor="tripDuration" className="block text-sm font-medium mb-1">
          Длительность (дней): {watchTripDuration || 7}
        </Label>
        <div className="flex items-center">
          <Slider
            id="tripDuration"
            min={3}
            max={21}
            step={1}
            defaultValue={[watchTripDuration || 7]}
            onValueChange={(value) => setValue('tripDuration', value[0])}
            className="flex-1"
          />
          <span className="ml-2 min-w-[30px] text-center">{watchTripDuration || 7}</span>
        </div>
      </div>
      
      {/* Priorities Section */}
      <div>
        <h3 className="text-sm font-medium mb-2">Приоритеты (0-10)</h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="hotelStars" className="text-sm w-24">Звёздность</Label>
            <div className="flex-1 mx-2">
              <Slider
                id="hotelStars"
                min={0}
                max={10}
                step={1}
                defaultValue={[watchPriorities?.hotelStars || 5]}
                onValueChange={(value) => handlePriorityChange('hotelStars', value)}
              />
            </div>
            <span className="text-sm font-medium w-6 text-center">{watchPriorities?.hotelStars || 5}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="beachLine" className="text-sm w-24">Первая линия</Label>
            <div className="flex-1 mx-2">
              <Slider
                id="beachLine"
                min={0}
                max={10}
                step={1}
                defaultValue={[watchPriorities?.beachLine || 7]}
                onValueChange={(value) => handlePriorityChange('beachLine', value)}
              />
            </div>
            <span className="text-sm font-medium w-6 text-center">{watchPriorities?.beachLine || 7}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="allInclusive" className="text-sm w-24">Всё включено</Label>
            <div className="flex-1 mx-2">
              <Slider
                id="allInclusive"
                min={0}
                max={10}
                step={1}
                defaultValue={[watchPriorities?.allInclusive || 8]}
                onValueChange={(value) => handlePriorityChange('allInclusive', value)}
              />
            </div>
            <span className="text-sm font-medium w-6 text-center">{watchPriorities?.allInclusive || 8}</span>
          </div>
        </div>
      </div>
      
      {/* Deadline Field */}
      <div>
        <Label htmlFor="deadline" className="block text-sm font-medium mb-1">Срок ожидания</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !watch('deadline') && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {watch('deadline') ? format(watch('deadline'), 'PPP', { locale: ru }) : <span>Без срока</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={watch('deadline')}
              onSelect={(date) => setValue('deadline', date)}
              initialFocus
              locale={ru}
              fromDate={new Date()}
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-telegram-midgray mt-1">До этой даты мы будем искать идеальные предложения</p>
      </div>
      
      {/* Active Status */}
      {existingWatchlist && (
        <div>
          <Label htmlFor="active" className="block text-sm font-medium mb-1">Статус</Label>
          <Select 
            defaultValue={String(existingWatchlist.active)}
            onValueChange={(value) => setValue('active', value === 'true')}
          >
            <SelectTrigger id="active" className="w-full">
              <SelectValue placeholder="Выберите статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Активный</SelectItem>
              <SelectItem value="false">Приостановлен</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Form Buttons */}
      <div className="flex justify-end space-x-2 pt-2">
        <Button 
          type="button" 
          variant="outline"
          onClick={onCancel}
        >
          Отмена
        </Button>
        <Button 
          type="submit" 
          className="bg-telegram-blue hover:bg-blue-600 text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохранение...' : existingWatchlist ? 'Обновить' : 'Добавить'}
        </Button>
      </div>
    </form>
  );
};

export default WatchlistForm;
