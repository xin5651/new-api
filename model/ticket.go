package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// Support ticket feature (custom 二次开发, 见 CUSTOM.md).
// 工单与回复是新增表，不改动上游任何原有表结构。

const (
	TicketStatusOpen    = 0 // 待处理
	TicketStatusReplied = 1 // 已回复（等待用户）
	TicketStatusClosed  = 2 // 已关闭
)

const (
	TicketPriorityLow    = 0
	TicketPriorityNormal = 1
	TicketPriorityHigh   = 2
)

type Ticket struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	UserId     int    `json:"user_id" gorm:"index"`
	Username   string `json:"username" gorm:"type:varchar(64)"`
	Title      string `json:"title" gorm:"type:varchar(200);not null"`
	Category   string `json:"category" gorm:"type:varchar(50);index"`
	Priority   int    `json:"priority" gorm:"type:int"`
	Status     int    `json:"status" gorm:"type:int;index"`
	Content    string `json:"content" gorm:"type:text;not null"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
	ReplyCount int    `json:"reply_count" gorm:"-:all"`
}

type TicketReply struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	TicketId  int    `json:"ticket_id" gorm:"index;not null"`
	UserId    int    `json:"user_id"`
	Username  string `json:"username" gorm:"type:varchar(64)"`
	IsAdmin   bool   `json:"is_admin"`
	Content   string `json:"content" gorm:"type:text;not null"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func GetTicketById(id int) (*Ticket, error) {
	if id == 0 {
		return nil, errors.New("id 为空")
	}
	ticket := Ticket{Id: id}
	err := DB.First(&ticket, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	var count int64
	DB.Model(&TicketReply{}).Where("ticket_id = ?", id).Count(&count)
	ticket.ReplyCount = int(count)
	return &ticket, nil
}

func CreateTicket(ticket *Ticket) error {
	now := common.GetTimestamp()
	ticket.CreatedAt = now
	ticket.UpdatedAt = now
	ticket.Status = TicketStatusOpen
	return DB.Create(ticket).Error
}

// GetTickets 分页查询工单。userId > 0 时只查该用户的工单（普通用户视角）；
// userId == 0 时查全部工单（管理员视角）。status 传 -1 表示不限状态。
func GetTickets(userId int, status int, keyword string, startIdx int, num int) (tickets []*Ticket, total int64, err error) {
	query := DB.Model(&Ticket{})
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if status >= 0 {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR content LIKE ?", like, like)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err = query.Order("updated_at desc, id desc").Limit(num).Offset(startIdx).Find(&tickets).Error; err != nil {
		return nil, 0, err
	}
	for _, ticket := range tickets {
		var count int64
		DB.Model(&TicketReply{}).Where("ticket_id = ?", ticket.Id).Count(&count)
		ticket.ReplyCount = int(count)
	}
	return tickets, total, nil
}

func GetTicketReplies(ticketId int) (replies []*TicketReply, err error) {
	err = DB.Where("ticket_id = ?", ticketId).Order("id asc").Find(&replies).Error
	return replies, err
}

func CreateTicketReply(reply *TicketReply) error {
	reply.CreatedAt = common.GetTimestamp()
	return DB.Create(reply).Error
}

// TouchTicket 在有新回复时更新工单状态与更新时间。
// 管理员回复 -> 已回复；用户回复 -> 回到待处理。
func TouchTicket(ticketId int, byAdmin bool) error {
	status := TicketStatusOpen
	if byAdmin {
		status = TicketStatusReplied
	}
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"status":     status,
		"updated_at": common.GetTimestamp(),
	}).Error
}

func UpdateTicketStatus(ticketId int, status int) error {
	if status < TicketStatusOpen || status > TicketStatusClosed {
		return errors.New("无效的工单状态")
	}
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"status":     status,
		"updated_at": common.GetTimestamp(),
	}).Error
}
