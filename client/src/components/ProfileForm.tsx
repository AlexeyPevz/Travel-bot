import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { Profile } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser } from '@/lib/telegramWebApp';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ProfileFormProps {
  existingProfile?: Profile | null;
  userId: string;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  vacationType?: string;
  countries?: string[];
  departureCity?: string;
  destination: string;
  dateType: 'fixed' | 'flexible';
  startDate?: Date;
  endDate?: Date;
  flexibleMonth?: string;
  tripDuration?: number;
  budget: number;
  priorities: Record<string, number>;
  deadline?: Date;
}

const ProfileForm = ({ existingProfile, userId, onSuccess }: ProfileFormProps) => {
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const [dateType, setDateType] = useState<'fixed' | 'flexible'>(existingProfile?.dateType || 'fixed');

  // Initialize form with existing profile data or defaults
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name: existingProfile?.name || telegramUser?.first_name || '',
      vacationType: existingProfile?.vacationType || 'beach',
      countries: existingProfile?.countries || [],
      departureCity: (existingProfile as any)?.departureCity || 'Москва',
      destination: existingProfile?.destination || '',
      dateType: existingProfile?.dateType || 'fixed',
      startDate: existingProfile?.startDate ? new Date(existingProfile.startDate) : undefined,
      endDate: existingProfile?.endDate ? new Date(existingProfile.endDate) : undefined,
      flexibleMonth: existingProfile?.flexibleMonth || '',
      tripDuration: existingProfile?.tripDuration || 7,
      budget: existingProfile?.budget || 100000,
      priorities: existingProfile?.priorities || {
        hotelStars: 5,
        beachLine: 7,
        allInclusive: 8,
        reviews: 6,
        renovation: 4,
        animation: 5
      },
      deadline: existingProfile?.deadline ? new Date(existingProfile.deadline) : undefined
    }
  });

  // Watch form values
  const watchDateType = watch('dateType');
  const watchBudget = watch('budget');
  const watchTripDuration = watch('tripDuration');
  const watchPriorities = watch('priorities');
  const watchVacationType = watch('vacationType');
  
  // State for vacation type criteria
  const [vacationTypeCriteria, setVacationTypeCriteria] = useState<Array<{key: string, label: string, description?: string}>>([]);

  // Load vacation type criteria when vacation type changes
  useEffect(() => {
    const loadVacationTypeCriteria = async () => {
      try {
        if (!watchVacationType) return;
        
        // Fetch criteria for the selected vacation type from the backend
        const vacationType = await apiRequest('GET', `/api/vacation-types/${watchVacationType}`);
        
        if (vacationType && vacationType.criteria) {
          setVacationTypeCriteria(vacationType.criteria);
          
          // Initialize priorities for new criteria if they don't exist yet
          const updatedPriorities = {...watchPriorities};
          vacationType.criteria.forEach((criterion: {key: string}) => {
            if (updatedPriorities[criterion.key] === undefined) {
              updatedPriorities[criterion.key] = 5; // Default medium priority
            }
          });
          
          setValue('priorities', updatedPriorities);
        }
      } catch (error) {
        console.error('Error loading vacation type criteria:', error);
        // Use default beach vacation criteria as fallback
        const defaultCriteria = [
          { key: "hotelStars", label: "Звёздность" },
          { key: "beachLine", label: "Первая линия" },
          { key: "allInclusive", label: "Всё включено" },
          { key: "reviews", label: "Отзывы" },
          { key: "renovation", label: "Реновация" },
          { key: "animation", label: "Анимация" }
        ];
        setVacationTypeCriteria(defaultCriteria);
      }
    };
    
    loadVacationTypeCriteria();
  }, [watchVacationType, setValue, watchPriorities]);

  // Update date type when it changes
  useEffect(() => {
    setDateType(watchDateType);
  }, [watchDateType]);

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Ensure all date fields are properly formatted as Date objects before sending
      const profileData = {
        ...data,
        userId,
        // Ensure deadline is properly formatted as ISO string if it exists
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        // Ensure dates are properly formatted
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null
      };
      
      // Log data before submitting to check format
      console.log('Submitting profile data:', profileData);
      
      // Submit the form
      const response = await apiRequest('POST', '/api/profile', profileData);
      console.log('Profile update response:', response);
      
      toast({
        title: "Профиль обновлен",
        description: "Ваш профиль успешно обновлен",
        variant: "default"
      });
      
      // Инвалидируем кэш, чтобы обновить данные профиля
      import('@/lib/queryClient').then(module => {
        const queryClient = module.queryClient;
        queryClient.invalidateQueries({ queryKey: [`/api/v1/profile/${userId}`] });
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting profile:', error);
      toast({
        title: "Ошибка при сохранении профиля",
        description: error instanceof Error ? error.message : "Произошла ошибка при сохранении профиля",
        variant: "destructive"
      });
    }
  };

  const handlePriorityChange = (key: keyof FormValues['priorities'], value: number[]) => {
    setValue(`priorities.${key}`, value[0]);
  };

  const handleDateTypeSelect = (type: 'fixed' | 'flexible') => {
    setValue('dateType', type);
    setDateType(type);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Name Field */}
          <div className="mb-4">
            <Label htmlFor="name" className="block text-sm font-medium mb-1">Имя</Label>
            <Input 
              id="name" 
              type="text"
              {...register("name", { required: "Имя обязательно" })}
              className="w-full"
              placeholder="Ваше имя"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          {/* Vacation Type Field */}
          <div className="mb-4">
            <Label htmlFor="vacationType" className="block text-sm font-medium mb-1">Тип отдыха</Label>
            <Select 
              defaultValue={watch('vacationType') || "beach"}
              onValueChange={(value) => setValue('vacationType', value)}
            >
              <SelectTrigger id="vacationType" className="w-full">
                <SelectValue placeholder="Выберите тип отдыха" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beach">Пляжный отдых</SelectItem>
                <SelectItem value="ski">Горнолыжный отдых</SelectItem>
                <SelectItem value="excursion">Экскурсионный тур</SelectItem>
                <SelectItem value="wellness">Оздоровительный отдых</SelectItem>
                <SelectItem value="cruise">Круиз</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Countries Field */}
          <div className="mb-4">
            <Label htmlFor="countries" className="block text-sm font-medium mb-1">Интересующие страны</Label>
            <Input 
              id="countries" 
              type="text"
              className="w-full"
              placeholder="Введите страны через запятую"
              defaultValue={watch('countries')?.join(', ') || ''}
              onChange={(e) => {
                const countriesText = e.target.value;
                const countriesArray = countriesText.split(',').map(c => c.trim()).filter(c => c.length > 0);
                setValue('countries', countriesArray);
              }}
            />
          </div>

          {/* Departure City Field */}
          <div className="mb-4">
            <Label htmlFor="departureCity" className="block text-sm font-medium mb-1">Город вылета</Label>
            <Select 
              defaultValue={watch('departureCity') || 'Москва'}
              onValueChange={(value) => setValue('departureCity', value)}
            >
              <SelectTrigger id="departureCity" className="w-full">
                <SelectValue placeholder="Выберите город вылета" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Москва">Москва</SelectItem>
                <SelectItem value="Санкт-Петербург">Санкт-Петербург</SelectItem>
                <SelectItem value="Казань">Казань</SelectItem>
                <SelectItem value="Екатеринбург">Екатеринбург</SelectItem>
                <SelectItem value="Новосибирск">Новосибирск</SelectItem>
                <SelectItem value="Ростов-на-Дону">Ростов-на-Дону</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Destination Field */}
          <div className="mb-4">
            <Label htmlFor="destination" className="block text-sm font-medium mb-1">Направление</Label>
            <Select 
              defaultValue={existingProfile?.destination || ""}
              onValueChange={(value) => setValue('destination', value)}
            >
              <SelectTrigger id="destination" className="w-full">
                <SelectValue placeholder="Выберите страну или регион" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="turkey">Турция</SelectItem>
                <SelectItem value="egypt">Египет</SelectItem>
                <SelectItem value="thailand">Таиланд</SelectItem>
                <SelectItem value="uae">ОАЭ</SelectItem>
                <SelectItem value="europe">Европа</SelectItem>
                <SelectItem value="asia">Азия</SelectItem>
                <SelectItem value="russia">Россия</SelectItem>
              </SelectContent>
            </Select>
            {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
          </div>
          
          {/* Dates Selector */}
          <div className="mb-4">
            <Label className="block text-sm font-medium mb-1">Даты поездки</Label>
            
            <div className="flex space-x-2 mb-2">
              <Button 
                type="button" 
                className={`flex-1 py-2 ${dateType === 'fixed' ? 'bg-telegram-blue text-white' : 'bg-white text-telegram-blue border border-telegram-blue'}`}
                onClick={() => handleDateTypeSelect('fixed')}
              >
                Точные даты
              </Button>
              <Button 
                type="button" 
                className={`flex-1 py-2 ${dateType === 'flexible' ? 'bg-telegram-blue text-white' : 'bg-white text-telegram-blue border border-telegram-blue'}`}
                onClick={() => handleDateTypeSelect('flexible')}
              >
                Гибкие даты
              </Button>
            </div>
            
            {/* Fixed Dates Inputs */}
            {dateType === 'fixed' && (
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="block text-sm font-medium mb-1">Дата вылета</Label>
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
                        {watch('startDate') ? format(watch('startDate'), 'PPP', { locale: ru }) : <span>Выберите дату</span>}
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
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate" className="block text-sm font-medium mb-1">Дата возвращения</Label>
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
                        {watch('endDate') ? format(watch('endDate'), 'PPP', { locale: ru }) : <span>Выберите дату</span>}
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
            )}
            
            {/* Flexible Dates Inputs */}
            {dateType === 'flexible' && (
              <div>
                <Label htmlFor="flexibleMonth" className="block text-sm font-medium mb-1">Предпочтительный месяц</Label>
                <Select 
                  defaultValue={existingProfile?.flexibleMonth || "current"}
                  onValueChange={(value) => setValue('flexibleMonth', value)}
                >
                  <SelectTrigger id="flexibleMonth" className="w-full">
                    <SelectValue placeholder="Выберите период" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Текущий месяц</SelectItem>
                    <SelectItem value="next">Следующий месяц</SelectItem>
                    <SelectItem value="after_next">Через месяц</SelectItem>
                    <SelectItem value="summer">Лето</SelectItem>
                    <SelectItem value="winter">Зима</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="mt-2">
                  <Label htmlFor="tripDuration" className="block text-sm font-medium mb-1">
                    Длительность (дней): {watchTripDuration}
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
              </div>
            )}
          </div>
          
          {/* Budget Slider */}
          <div className="mb-4">
            <Label htmlFor="budget" className="block text-sm font-medium mb-1">
              Бюджет (₽ на человека): {watchBudget?.toLocaleString() || '100,000'} ₽
            </Label>
            <div className="flex items-center">
              <Slider
                id="budget"
                min={30000}
                max={300000}
                step={5000}
                defaultValue={[watchBudget || 100000]}
                onValueChange={(value) => setValue('budget', value[0])}
                className="flex-1"
              />
              <span className="ml-2 min-w-[80px] text-center">
                {watchBudget?.toLocaleString() || '100,000'} ₽
              </span>
            </div>
          </div>
          
          {/* Priorities Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Приоритеты для {watchVacationType === 'beach' ? 'пляжного отдыха' : 
                                                  watchVacationType === 'ski' ? 'горнолыжного отдыха' : 
                                                  watchVacationType === 'excursion' ? 'экскурсионного тура' : 
                                                  watchVacationType === 'wellness' ? 'оздоровительного отдыха' : 
                                                  watchVacationType === 'cruise' ? 'круиза' : 'отдыха'} (0-10)</h3>
            
            {vacationTypeCriteria.length > 0 ? (
              vacationTypeCriteria.map((criterion) => (
                <div key={criterion.key} className="flex items-center justify-between mb-2">
                  <Label 
                    htmlFor={criterion.key} 
                    className="text-sm w-36"
                    title={criterion.description || ''}
                  >
                    {criterion.label}
                  </Label>
                  <div className="flex-1 mx-2">
                    <Slider
                      id={criterion.key}
                      min={0}
                      max={10}
                      step={1}
                      defaultValue={[watchPriorities?.[criterion.key] || 5]}
                      onValueChange={(value) => handlePriorityChange(criterion.key as keyof FormValues['priorities'], value)}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-center">{watchPriorities?.[criterion.key] || 5}</span>
                </div>
              ))
            ) : (
              // Fallback if no criteria are loaded
              <>
                <div className="flex items-center justify-between mb-2">
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
                
                <div className="flex items-center justify-between mb-2">
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
                
                <div className="flex items-center justify-between mb-2">
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
              </>
            )}
          </div>
          
          {/* Deadline Section */}
          <div className="mb-4">
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
                  {watch('deadline') ? format(watch('deadline'), 'PPP', { locale: ru }) : <span>Выберите дату</span>}
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
          
          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-telegram-blue hover:bg-blue-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Сохранение...' : existingProfile ? 'Обновить профиль' : 'Сохранить профиль'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;
