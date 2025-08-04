import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TravelBuddyFormProps {
  userId: string;
  onSuccess: () => void;
}

interface FormValues {
  destination: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  description?: string;
  agePreference?: string;
  genderPreference?: string;
}

const TravelBuddyForm = ({ userId, onSuccess }: TravelBuddyFormProps) => {
  const { toast } = useToast();

  // Initialize form
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      destination: '',
      budget: 100000,
      description: '',
      agePreference: 'any',
      genderPreference: 'any'
    }
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Include userId in the data
      const requestData = {
        ...data,
        userId
      };
      
      // Submit the form
      await apiRequest('POST', '/api/poputchik', requestData);
      
      toast({
        title: "Запрос создан",
        description: "Ваш запрос на поиск попутчика отправлен",
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting buddy request:', error);
      toast({
        title: "Ошибка при создании запроса",
        description: error instanceof Error ? error.message : "Произошла ошибка при создании запроса",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-medium mb-3">Создайте запрос на поиск попутчика</h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Destination Field */}
          <div>
            <Label htmlFor="destination" className="block text-sm font-medium mb-1">Куда хотите поехать</Label>
            <Input
              id="destination"
              {...register("destination", { required: "Необходимо указать направление" })}
              placeholder="Например: Турция, Анталия"
            />
            {errors.destination && <p className="text-red-500 text-xs mt-1">{errors.destination.message}</p>}
          </div>
          
          {/* Dates Field */}
          <div>
            <Label className="block text-sm font-medium mb-1">Примерные даты</Label>
            <div className="grid grid-cols-2 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watch('startDate') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('startDate') ? format(watch('startDate'), 'PPP', { locale: ru }) : <span>Дата с</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('startDate')}
                    onSelect={(date) => setValue('startDate', date)}
                    initialFocus
                    locale={ru}
                    fromDate={new Date()}
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watch('endDate') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('endDate') ? format(watch('endDate'), 'PPP', { locale: ru }) : <span>Дата по</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('endDate')}
                    onSelect={(date) => setValue('endDate', date)}
                    initialFocus
                    locale={ru}
                    fromDate={watch('startDate') || new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Budget Field */}
          <div>
            <Label htmlFor="budget" className="block text-sm font-medium mb-1">Бюджет (₽ на человека)</Label>
            <Input
              id="budget"
              type="number"
              {...register("budget", { 
                valueAsNumber: true,
                min: { value: 10000, message: "Минимальный бюджет 10 000 ₽" }
              })}
              placeholder="Например: 100000"
            />
            {errors.budget && <p className="text-red-500 text-xs mt-1">{errors.budget.message}</p>}
          </div>
          
          {/* Description Field */}
          <div>
            <Label htmlFor="description" className="block text-sm font-medium mb-1">О себе и пожеланиях</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Расскажите немного о себе и что ищете в попутчике"
              rows={3}
            />
          </div>
          
          {/* Preferences (Age and Gender) */}
          <div className="flex space-x-3">
            <div className="flex-1">
              <Label htmlFor="agePreference" className="block text-sm font-medium mb-1">Возраст попутчика</Label>
              <Select 
                defaultValue="any"
                onValueChange={(value) => setValue('agePreference', value)}
              >
                <SelectTrigger id="agePreference" className="w-full">
                  <SelectValue placeholder="Выберите возраст" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Любой</SelectItem>
                  <SelectItem value="18-25">18-25 лет</SelectItem>
                  <SelectItem value="26-35">26-35 лет</SelectItem>
                  <SelectItem value="36-45">36-45 лет</SelectItem>
                  <SelectItem value="46+">46+ лет</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="genderPreference" className="block text-sm font-medium mb-1">Пол</Label>
              <Select 
                defaultValue="any"
                onValueChange={(value) => setValue('genderPreference', value)}
              >
                <SelectTrigger id="genderPreference" className="w-full">
                  <SelectValue placeholder="Выберите пол" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Любой</SelectItem>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-telegram-blue hover:bg-blue-600 text-white mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Создание запроса...' : 'Найти попутчика'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TravelBuddyForm;
