"use client";  

import React, { useState, useMemo, useEffect } from 'react';
// Импортируем наш новый сервис
import { getActiveMenu, submitOrderToDjango } from './services/orderService'; 
// Убираем статические данные
// import { MENU_DATA } from './constants'; // <-- УДАЛИТЬ

// Добавить в AppState: availableItems для хранения данных из Django
interface AppState {
    // ... (старые поля) ...
    availableItems: MenuItem[]; // Новое поле для данных из API
    dailyMenuId: string | null; // ID DailyMenu (UUID), необходимый для POST
    // ...
}

const App: React.FC = () => {
    const [state, setState] = useState<AppState>({
        // ... (инициализация) ...
        availableItems: [], // Инициализируем пустым массивом
        dailyMenuId: null, // Инициализируем NULL
    });

    // --- НОВЫЙ useEffect для загрузки данных ---
    useEffect(() => {
        // Функция для загрузки меню
        const loadMenu = async () => {
            try {
                // ПРИМЕЧАНИЕ: В реальном TWA-приложении дата должна быть Tomorrow's Date
                const menuResponse = await getActiveMenu(state.selectedDate); 
                
                // Пример: Response должен содержать Menu Options и ID Menu Дня
                setState(prev => ({ 
                    ...prev, 
                    availableItems: menuResponse.options, // Массив MenuOption
                    dailyMenuId: menuResponse.id, // ID DailyMenu
                }));
            } catch (error) {
                console.error("Failed to load menu:", error);
                // setState(prev => ({ ...prev, error: "Не удалось загрузить меню." }));
            }
        };
        loadMenu();
    }, [state.selectedDate]);
    
    // ... (filteredItems должен использовать state.availableItems) ...
    const filteredItems = useMemo(() => {
        return state.availableItems.filter(item => item.category === state.activeCategory);
    }, [state.activeCategory, state.availableItems]);

    // --- НОВАЯ ФУНКЦИЯ: ОТПРАВКА ЗАКАЗА В DJANGO ---
    const handleSubmitOrder = async () => {
        if (state.selectedItems.length === 0 || !state.dailyMenuId) return;

        setState(prev => ({ ...prev, isProcessing: true }));

        // 1. Форматируем данные для Django API (Payload)
        const payload: DjangoOrderPayload = {
            daily_menu_id: state.dailyMenuId,
            items: state.selectedItems.map(item => ({
                // item.id из вашего MenuItem теперь должен быть menu_option_id (UUID)
                menu_option_id: item.id, 
                quantity: item.quantity,
            }))
        };
        
        try {
            const order = await submitOrderToDjango(payload);
            // Успех: перенаправление на страницу оплаты
            alert(`Заказ #${order.id} на сумму ${order.total_amount} создан!`);
            // Здесь должна быть логика открытия окна О!Деньги
            
        } catch (error: any) {
            alert(error.message); // Показываем ошибку из Service Layer
        } finally {
            setState(prev => ({ ...prev, isProcessing: false }));
        }
    };
    
    // ... (В секции Footer) ...
    <button 
        onClick={handleSubmitOrder} // <--- Привязываем новую функцию
        disabled={state.selectedItems.length === 0 || state.isProcessing}
        // ... (стили) ...
    >
        <span>Proceed to Order</span>
        {/* ... */}
    </button>
};

export default App;