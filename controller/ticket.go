package controller

import (
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// Support ticket feature (custom 二次开发, 见 CUSTOM.md).
// 全部接口要求登录（路由层 UserAuth/AdminAuth）；
// 普通用户只能看和回复自己的工单，管理员可以看和处理全部工单。

func isTicketAdmin(c *gin.Context) bool {
	return c.GetInt("role") >= common.RoleAdminUser
}

// canAccessTicket 判断当前用户是否有权访问该工单：本人或管理员。
func canAccessTicket(c *gin.Context, ticket *model.Ticket) bool {
	return isTicketAdmin(c) || ticket.UserId == c.GetInt("id")
}

type createTicketRequest struct {
	Title    string `json:"title"`
	Category string `json:"category"`
	Priority int    `json:"priority"`
	Content  string `json:"content"`
}

// CreateTicket 登录用户提交工单
func CreateTicket(c *gin.Context) {
	var req createTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if n := utf8.RuneCountInString(req.Title); n == 0 || n > 200 {
		common.ApiErrorT(c, "Ticket title length must be between 1-200")
		return
	}
	if n := utf8.RuneCountInString(req.Content); n == 0 || n > 10000 {
		common.ApiErrorT(c, "Ticket content length must be between 1-10000")
		return
	}
	if utf8.RuneCountInString(req.Category) > 50 {
		common.ApiErrorT(c, "Ticket category is too long")
		return
	}
	if req.Priority < model.TicketPriorityLow || req.Priority > model.TicketPriorityHigh {
		req.Priority = model.TicketPriorityNormal
	}
	ticket := &model.Ticket{
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		Title:    req.Title,
		Category: req.Category,
		Priority: req.Priority,
		Content:  req.Content,
	}
	if err := model.CreateTicket(ticket); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

// GetSelfTickets 当前用户的工单列表（分页，可按状态筛选、关键词搜索）
func GetSelfTickets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status, _ := strconv.Atoi(c.DefaultQuery("status", "-1"))
	tickets, total, err := model.GetTickets(c.GetInt("id"), status, c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

// GetAllTickets 管理员查看全部工单（分页，可按状态筛选、关键词搜索）
func GetAllTickets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status, _ := strconv.Atoi(c.DefaultQuery("status", "-1"))
	tickets, total, err := model.GetTickets(0, status, c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

// GetTicket 工单详情（含回复列表）；仅本人或管理员可见
func GetTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canAccessTicket(c, ticket) {
		common.ApiErrorT(c, "No permission to access this ticket")
		return
	}
	replies, err := model.GetTicketReplies(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"replies": replies,
	})
}

type replyTicketRequest struct {
	Content string `json:"content"`
}

// ReplyTicket 回复工单；已关闭的工单不能再回复
func ReplyTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req replyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if n := utf8.RuneCountInString(req.Content); n == 0 || n > 10000 {
		common.ApiErrorT(c, "Reply content length must be between 1-10000")
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canAccessTicket(c, ticket) {
		common.ApiErrorT(c, "No permission to access this ticket")
		return
	}
	if ticket.Status == model.TicketStatusClosed {
		common.ApiErrorT(c, "This ticket is closed")
		return
	}
	byAdmin := isTicketAdmin(c)
	reply := &model.TicketReply{
		TicketId: id,
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		IsAdmin:  byAdmin,
		Content:  req.Content,
	}
	if err := model.CreateTicketReply(reply); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.TouchTicket(id, byAdmin); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, reply)
}

type updateTicketStatusRequest struct {
	Status int `json:"status"`
}

// UpdateTicketStatus 修改工单状态：管理员可任意设置；普通用户只能关闭自己的工单
func UpdateTicketStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req updateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !isTicketAdmin(c) {
		if ticket.UserId != c.GetInt("id") || req.Status != model.TicketStatusClosed {
			common.ApiErrorT(c, "No permission to access this ticket")
			return
		}
	}
	if err := model.UpdateTicketStatus(id, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
